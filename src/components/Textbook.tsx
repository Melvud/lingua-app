// src/components/Textbook.tsx
import React, { useRef, useCallback, useEffect, useState } from 'react';
// ИСПРАВЛЕНО: Возвращаем иконки инструментов
import { UploadIcon, PenIcon, EraserIcon, HighlighterIcon, ZoomInIcon, ZoomOutIcon } from './Icons';
// ИСПРАВЛЕНО: Возвращаем типы
import type { Annotation, AnnotationStore, Tool, TextbookFile, AnnotationPoint } from '../types';
import { Document, Page, pdfjs } from 'react-pdf';

// Воркер PDF.js (без изменений)
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();


interface TextbookProps {
    textbooks: TextbookFile[];
    selectedTextbook: TextbookFile | null;
    onSelectTextbook: (name: string | null) => void;
    onAddTextbook: (file: File) => void;
    numPages: number;
    setNumPages: (count: number) => void;
    currentPage: number;
    setCurrentPage: (page: number) => void;
    // ИСПРАВЛЕНО: Добавлены props для инструментов и аннотаций
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
    const [zoom, setZoom] = useState(1.5);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // ИСПРАВЛЕНО: Возвращаем логику canvas
    const annotationCanvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    // Это ref для хранения *текущей* рисуемой линии (локально)
    const currentDrawingRef = useRef<Annotation | null>(null); 
    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

    const getContext = (canvas: HTMLCanvasElement | null) => canvas?.getContext('2d');
    
    // --- Логика рисования ---

    // Функция для получения координат с учетом зума
    const getPointFromEvent = (e: React.MouseEvent<HTMLCanvasElement>): AnnotationPoint => {
      const { offsetX, offsetY } = e.nativeEvent;
      return { x: offsetX / zoom, y: offsetY / zoom };
    };

    // Функция отрисовки ВСЕХ сохраненных аннотаций из props
    const drawAllAnnotations = useCallback(() => {
        const canvas = annotationCanvasRef.current;
        const ctx = getContext(canvas);
        if (!ctx || !canvas) return;

        // Очищаем холст
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Получаем аннотации для ТЕКУЩЕЙ страницы
        const pageAnnotations = annotations[currentPage] || [];

        pageAnnotations.forEach(ann => {
            ctx.beginPath();
            ctx.strokeStyle = ann.color;
            ctx.lineWidth = ann.tool === 'highlighter' ? 10 : (ann.tool === 'eraser' ? 15 : 3);
            ctx.globalAlpha = ann.tool === 'highlighter' ? 0.3 : 1.0;
            ctx.globalCompositeOperation = ann.tool === 'eraser' ? 'destination-out' : 'source-over';
            
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
        
        // Сбрасываем настройки контекста
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1.0;
    }, [annotations, currentPage, zoom, canvasSize]); // Зависим от canvasSize, чтобы перерисовать при рендере

    // Перерисовываем все, когда меняются аннотации, страница или зум
    useEffect(() => {
        drawAllAnnotations();
    }, [zoom, currentPage, drawAllAnnotations]);


    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.type === 'application/pdf') onAddTextbook(file);
    };
    
    // Начало рисования
    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!selectedTextbook) return;
        
        setIsDrawing(true);
        const startPoint = getPointFromEvent(e);
        
        // Сохраняем новую линию в ЛОКАЛЬНЫЙ ref
        currentDrawingRef.current = { 
            tool, 
            color, 
            points: [startPoint]
        };
    };

    // Процесс рисования
    const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing || !selectedTextbook || !currentDrawingRef.current) return;
        
        const canvas = annotationCanvasRef.current;
        const ctx = getContext(canvas);
        if (!ctx || !canvas) return;
        
        const currentAnn = currentDrawingRef.current;
        const newPoint = getPointFromEvent(e);
        currentAnn.points.push(newPoint);

        // Рисуем ЛОКАЛЬНО только последний сегмент для производительности
        const prevPoint = currentAnn.points[currentAnn.points.length - 2];
        
        ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
        ctx.strokeStyle = currentAnn.color;
        ctx.lineWidth = tool === 'highlighter' ? 10 : (tool === 'eraser' ? 15 : 3);
        ctx.globalAlpha = tool === 'highlighter' ? 0.3 : 1.0;
        
        ctx.beginPath();
        ctx.moveTo(prevPoint.x * zoom, prevPoint.y * zoom);
        ctx.lineTo(newPoint.x * zoom, newPoint.y * zoom);
        ctx.stroke();
    };
    
    // Окончание рисования
    const stopDrawing = () => {
        if (!isDrawing || !currentDrawingRef.current) return;
        
        setIsDrawing(false);
        
        // Получаем завершенную линию из ref
        const finishedAnnotation = currentDrawingRef.current;
        currentDrawingRef.current = null; // Очищаем ref

        // Если это был просто клик, не сохраняем
        if (finishedAnnotation.points.length < 2) {
             drawAllAnnotations(); // Перерисовываем, чтобы убрать "точку"
             return;
        }

        // Обновляем ОБЩЕЕ хранилище в Firestore
        const pageAnns = annotations[currentPage] || [];
        const newStore = {
            ...annotations,
            [currentPage]: [...pageAnns, finishedAnnotation]
        };
        onUpdateAnnotations(newStore);
        // `useEffect` автоматически перерисует все с новой линией
    };

    const onDocumentLoadSuccess = ({ numPages: nextNumPages }: { numPages: number }) => {
        setNumPages(nextNumPages);
        if(currentPage > nextNumPages) {
            setCurrentPage(nextNumPages);
        }
    };

    // ИСПРАВЛЕНО: Эта функция нужна для установки размера canvas
    const onPageRenderSuccess = () => {
        // Находим canvas, который рендерит сам react-pdf
        const pdfCanvas = annotationCanvasRef.current?.previousElementSibling?.querySelector('canvas');
        if (pdfCanvas) {
            // Устанавливаем размер нашего canvas-слоя равным размеру PDF-страницы
            const { width, height } = pdfCanvas.getBoundingClientRect();
            setCanvasSize({ width, height });
            // Перерисовываем аннотации, т.к. размер холста мог измениться
            drawAllAnnotations();
        }
    };
    
    // ИСПРАВЛЕНО: Возвращаем кнопку тулбара
    const ToolbarButton: React.FC<{
        label: string;
        currentTool: Tool;
        targetTool: Tool;
        onClick: (tool: Tool) => void;
        children: React.ReactNode;
    }> = ({ label, currentTool, targetTool, onClick, children }) => (
        <button
            onClick={() => onClick(targetTool)}
            className={`p-2 rounded-md transition-colors ${currentTool === targetTool ? 'bg-blue-500 text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}
            aria-label={label}
        >
            {children}
        </button>
    );

    // ИСПРАВЛЕНО: Возвращаем полный тулбар
    const Toolbar: React.FC = () => (
         <div className="flex items-center gap-2 p-2 bg-gray-100 dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <ToolbarButton label="Pen" currentTool={tool} targetTool="pen" onClick={setTool}><PenIcon className="w-6 h-6"/></ToolbarButton>
            <ToolbarButton label="Highlighter" currentTool={tool} targetTool="highlighter" onClick={setTool}><HighlighterIcon className="w-6 h-6"/></ToolbarButton>
            <ToolbarButton label="Eraser" currentTool={tool} targetTool="eraser" onClick={setTool}><EraserIcon className="w-6 h-6"/></ToolbarButton>
            <div className="w-px h-8 bg-gray-300 dark:bg-gray-600 mx-2"></div>
            <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-8 h-8 cursor-pointer rounded-md border-2 border-gray-300 dark:border-gray-600" disabled={tool === 'eraser'}/>
            <div className="w-px h-8 bg-gray-300 dark:bg-gray-600 mx-2"></div>
            <div className="flex items-center gap-2">
               <button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700"><ZoomOutIcon className="w-6 h-6"/></button>
                <span className="w-16 text-center font-semibold">{Math.round(zoom * 100)}%</span>
               <button onClick={() => setZoom(z => Math.min(3, z + 0.25))} className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700"><ZoomInIcon className="w-6 h-6"/></button>
            </div>
        </div>
    );
    
    // Пагинация (без изменений)
    const Pagination: React.FC = () => (
        <div className="flex items-center gap-4 p-2 bg-gray-100 dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="px-3 py-1 rounded disabled:opacity-50 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors font-bold">&lt;</button>
            <span>Стр. {currentPage} из {numPages || 0}</span>
            <button onClick={() => setCurrentPage(Math.min(numPages, currentPage + 1))} disabled={currentPage === numPages || numPages === 0} className="px-3 py-1 rounded disabled:opacity-50 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors font-bold">&gt;</button>
        </div>
    );

    return (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md h-full flex flex-col">
            {/* Хедер с выбором учебника (без изменений) */}
            <div className="flex-shrink-0 mb-4 flex items-center justify-between gap-4">
                 <div className="flex-1">
                    <select
                        value={selectedTextbook?.name || ''}
                        onChange={(e) => onSelectTextbook(e.target.value || null)}
                        className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={textbooks.length === 0}
                    >
                        {textbooks.length === 0 && <option value="">Загрузите учебник</option>}
                        {textbooks.length > 0 && <option value="">-- Выберите учебник --</option>}
                        {textbooks.map(tb => <option key={tb.name} value={tb.name}>{tb.name}</option>)}
                    </select>
                </div>
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 bg-blue-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors text-sm"
                >
                    <UploadIcon className="w-5 h-5"/>
                    Загрузить
                </button>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".pdf" />
            </div>

            {selectedTextbook ? (
                <>
                    {/* ИСПРАВЛЕНО: Возвращаем Тулбар */}
                    <div className="flex justify-center mb-4"><Toolbar /></div>
                    
                    {/* Контейнер для PDF и Canvas */}
                    <div className="flex-grow overflow-auto flex justify-center bg-gray-200 dark:bg-gray-900">
                        {/* ИСПРАВЛЕНО: Обертка с relative позиционированием и размером от canvasSize */}
                        <div className="relative" style={{ width: canvasSize.width, height: canvasSize.height }}>
                            <Document
                                file={selectedTextbook.url}
                                onLoadSuccess={onDocumentLoadSuccess}
                                loading={<p>Загрузка PDF...</p>}
                                error={`Не удалось загрузить PDF. Убедитесь, что CORS настроен, или файл не поврежден.`}
                            >
                                <Page
                                    pageNumber={currentPage}
                                    scale={zoom}
                                    onRenderSuccess={onPageRenderSuccess} // ИСПРАВЛЕНО: Возвращаем
                                    renderAnnotationLayer={false} // Оставляем false
                                    renderTextLayer={false} // Оставляем false для простоты
                                />
                            </Document>
                            
                            {/* ИСПРАВЛЕНО: Возвращаем <canvas> для рисования */}
                            <canvas 
                                ref={annotationCanvasRef}
                                width={canvasSize.width}
                                height={canvasSize.height}
                                className="absolute top-0 left-0 cursor-crosshair"
                                onMouseDown={startDrawing}
                                onMouseMove={draw}
                                onMouseUp={stopDrawing}
                                onMouseLeave={stopDrawing}
                            />
                        </div>
                    </div>
                    
                    {numPages > 1 && <div className="flex justify-center mt-auto pt-4"><Pagination /></div>}
                </>
            ) : (
                // (Заглушка ... без изменений)
                <div className="flex-grow flex items-center justify-center text-center text-gray-500 dark:text-gray-400">
                    <p>Пожалуйста, загрузите PDF-файл, чтобы начать работу.</p>
                </div>
            )}
        </div>
    );
};

export default Textbook;