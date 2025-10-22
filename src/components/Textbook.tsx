// src/components/Textbook.tsx
import React, { useRef, useCallback, useEffect, useState } from 'react';
import { UploadIcon, PenIcon, EraserIcon, HighlighterIcon, ZoomInIcon, ZoomOutIcon, TrashIcon } from './Icons';
import type { Annotation, AnnotationStore, Tool, TextbookFile, AnnotationPoint } from '../types';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Настройка worker для react-pdf
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

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

    // Утилиты для canvas
    const getContext = (canvas: HTMLCanvasElement | null) => canvas?.getContext('2d');
    
    const getPointFromEvent = (e: React.MouseEvent<HTMLCanvasElement>): AnnotationPoint => {
        const canvas = annotationCanvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / zoom;
        const y = (e.clientY - rect.top) / zoom;
        
        return { x, y };
    };

    // Отрисовка всех сохраненных аннотаций
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

    // Перерисовка при изменении аннотаций, страницы или зума
    useEffect(() => {
        if (pdfRendered) {
            drawAllAnnotations();
        }
    }, [zoom, currentPage, annotations, drawAllAnnotations, pdfRendered]);

    // Обработка загрузки файла
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
    
    // Рисование - начало
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

    // Рисование - процесс
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
    
    // Рисование - конец
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

    // Успешная загрузка документа
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

    // Ошибка загрузки документа
    const onDocumentLoadError = (error: Error) => {
        console.error('❌ PDF load error:', error);
        setLoading(false);
        setError('Не удалось загрузить PDF. Проверьте файл или попробуйте другой.');
    };

    // Успешный рендер страницы
    const onPageRenderSuccess = () => {
        console.log('✅ Page rendered successfully');
        setPdfRendered(true);
        
        // Находим canvas PDF и устанавливаем размер нашего canvas
        const pdfContainer = containerRef.current;
        if (pdfContainer) {
            const pdfCanvas = pdfContainer.querySelector('canvas');
            if (pdfCanvas) {
                const { width, height } = pdfCanvas.getBoundingClientRect();
                setCanvasSize({ width, height });
                
                // Небольшая задержка для гарантии отрисовки
                setTimeout(() => drawAllAnnotations(), 50);
            }
        }
    };

    // Очистка аннотаций текущей страницы
    const clearCurrentPageAnnotations = () => {
        if (!window.confirm('Удалить все аннотации на этой странице?')) return;
        
        const newStore = { ...annotations };
        delete newStore[currentPage];
        onUpdateAnnotations(newStore);
    };

    // Кнопка тулбара
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
            className={`p-2.5 rounded-lg transition-all duration-200 ${
                active 
                    ? 'bg-blue-500 text-white shadow-md' 
                    : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            aria-label={label}
            title={label}
        >
            {icon}
        </button>
    );

    // Тулбар
    const Toolbar: React.FC = () => (
        <div className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
            {/* Инструменты рисования */}
            <div className="flex items-center gap-1">
                <ToolbarButton 
                    label="Ручка" 
                    active={tool === 'pen'} 
                    onClick={() => setTool('pen')}
                    icon={<PenIcon className="w-5 h-5"/>}
                />
                <ToolbarButton 
                    label="Маркер" 
                    active={tool === 'highlighter'} 
                    onClick={() => setTool('highlighter')}
                    icon={<HighlighterIcon className="w-5 h-5"/>}
                />
                <ToolbarButton 
                    label="Ластик" 
                    active={tool === 'eraser'} 
                    onClick={() => setTool('eraser')}
                    icon={<EraserIcon className="w-5 h-5"/>}
                />
            </div>

            <div className="w-px h-8 bg-gray-300 dark:bg-gray-600"></div>

            {/* Цвет */}
            <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Цвет:</span>
                <input 
                    type="color" 
                    value={color} 
                    onChange={e => setColor(e.target.value)} 
                    disabled={tool === 'eraser'}
                    className="w-10 h-10 cursor-pointer rounded-md border-2 border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                />
            </div>

            <div className="w-px h-8 bg-gray-300 dark:bg-gray-600"></div>

            {/* Зум */}
            <div className="flex items-center gap-2">
                <button 
                    onClick={() => setZoom(z => Math.max(0.5, z - 0.2))} 
                    className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    title="Уменьшить"
                >
                    <ZoomOutIcon className="w-5 h-5"/>
                </button>
                <span className="w-16 text-center font-semibold text-sm text-gray-700 dark:text-gray-300">
                    {Math.round(zoom * 100)}%
                </span>
                <button 
                    onClick={() => setZoom(z => Math.min(3, z + 0.2))} 
                    className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    title="Увеличить"
                >
                    <ZoomInIcon className="w-5 h-5"/>
                </button>
            </div>

            <div className="w-px h-8 bg-gray-300 dark:bg-gray-600"></div>

            {/* Очистка */}
            <button
                onClick={clearCurrentPageAnnotations}
                disabled={!annotations[currentPage] || annotations[currentPage].length === 0}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Очистить аннотации на странице"
            >
                <TrashIcon className="w-5 h-5"/>
                <span className="text-sm font-medium">Очистить</span>
            </button>
        </div>
    );
    
    // Пагинация
    const Pagination: React.FC = () => (
        <div className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
            <button 
                onClick={() => setCurrentPage(1)} 
                disabled={currentPage === 1}
                className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Первая страница"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
            </button>

            <button 
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} 
                disabled={currentPage === 1}
                className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Предыдущая"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
            </button>

            <div className="flex items-center gap-2">
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
                    className="w-16 px-2 py-1 text-center border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <span className="text-gray-600 dark:text-gray-400">из {numPages || 0}</span>
            </div>

            <button 
                onClick={() => setCurrentPage(Math.min(numPages, currentPage + 1))} 
                disabled={currentPage === numPages || numPages === 0}
                className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Следующая"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
            </button>

            <button 
                onClick={() => setCurrentPage(numPages)} 
                disabled={currentPage === numPages || numPages === 0}
                className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Последняя страница"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
            </button>
        </div>
    );

    return (
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-6 rounded-xl shadow-lg h-full flex flex-col">
            {/* Хедер с выбором учебника */}
            <div className="flex-shrink-0 mb-4 flex items-center gap-3">
                <div className="flex-1 relative">
                    <select
                        value={selectedTextbook?.name || ''}
                        onChange={(e) => {
                            onSelectTextbook(e.target.value || null);
                            setPdfRendered(false);
                            setError('');
                        }}
                        className="w-full bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg py-2.5 px-4 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
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
                    className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2.5 px-5 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
                >
                    <UploadIcon className="w-5 h-5"/>
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
                    <div className="flex justify-center mb-4">
                        <Toolbar />
                    </div>
                    
                    {/* PDF Viewer */}
                    <div className="flex-grow overflow-auto bg-gray-200 dark:bg-gray-900 rounded-lg p-4 flex justify-center items-start">
                        <div 
                            ref={containerRef}
                            className="relative shadow-2xl"
                            style={{ 
                                width: canvasSize.width || 'auto',
                                height: canvasSize.height || 'auto'
                            }}
                        >
                            {loading && (
                                <div className="flex items-center justify-center p-12">
                                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                                </div>
                            )}
                            
                            {error && (
                                <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-800 rounded-lg p-6 m-4">
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
                                loading={<div className="p-8 text-center text-gray-600 dark:text-gray-400">Загрузка PDF...</div>}
                                error={<div className="p-8 text-center text-red-600 dark:text-red-400">Ошибка загрузки PDF</div>}
                            >
                                <Page
                                    pageNumber={currentPage}
                                    scale={zoom}
                                    onRenderSuccess={onPageRenderSuccess}
                                    renderAnnotationLayer={false}
                                    renderTextLayer={false}
                                    className="shadow-xl"
                                />
                            </Document>
                            
                            {/* Canvas для аннотаций */}
                            {pdfRendered && (
                                <canvas 
                                    ref={annotationCanvasRef}
                                    width={canvasSize.width}
                                    height={canvasSize.height}
                                    className="absolute top-0 left-0 cursor-crosshair"
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
                        <div className="flex justify-center mt-4">
                            <Pagination />
                        </div>
                    )}
                </>
            ) : (
                // Заглушка
                <div className="flex-grow flex flex-col items-center justify-center text-center p-8">
                    <div className="bg-blue-100 dark:bg-blue-900/30 rounded-full p-8 mb-6">
                        <svg className="w-20 h-20 text-blue-500 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-3">
                        Учебник не выбран
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 max-w-md mb-6">
                        Загрузите PDF-файл учебника и выберите его из списка, чтобы начать совместное изучение с партнером
                    </p>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
                    >
                        <UploadIcon className="w-6 h-6"/>
                        <span>Загрузить первый учебник</span>
                    </button>
                </div>
            )}
        </div>
    );
};

export default Textbook;