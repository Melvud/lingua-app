// src/components/Textbook.tsx
import React, { useRef, useCallback, useEffect, useState } from 'react';
import { UploadIcon, PenIcon, EraserIcon, HighlighterIcon, ZoomInIcon, ZoomOutIcon } from './Icons';
import type { Annotation, Tool, TextbookFile } from '../types';
import { Document, Page, pdfjs } from 'react-pdf';

// ИСПРАВЛЕНО: Эта строка теперь использует Vite для
// локальной загрузки воркера из 'node_modules', а не 'cdnjs'.
// Это решает все конфликты версий.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();


interface TextbookProps {
    textbooks: TextbookFile[];
    selectedTextbook: TextbookFile | null;
    setSelectedTextbook: (book: TextbookFile | null) => void;
    onAddTextbook: (file: File) => void;
    numPages: number;
    setNumPages: (count: number) => void;
    currentPage: number;
    setCurrentPage: (page: number) => void;
    tool: Tool;
    setTool: (tool: Tool) => void;
    color: string;
    setColor: (color: string) => void;
    annotations: { [key: number]: Annotation[] };
    setAnnotations: React.Dispatch<React.SetStateAction<{ [key: number]: Annotation[] }>>;
}

const Textbook: React.FC<TextbookProps> = ({
    textbooks, selectedTextbook, setSelectedTextbook, onAddTextbook,
    numPages, setNumPages, currentPage, setCurrentPage,
    tool, setTool, color, setColor,
    annotations, setAnnotations
}) => {
    const [zoom, setZoom] = useState(1.5);
    const annotationCanvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

    const getContext = (canvas: HTMLCanvasElement | null) => canvas?.getContext('2d');
    
    useEffect(() => {
        if (selectedTextbook) {
            const saved = localStorage.getItem(`annotations_${selectedTextbook.name}`);
            if (saved) setAnnotations(JSON.parse(saved));
            else setAnnotations({});
        }
    }, [selectedTextbook, setAnnotations]);

    useEffect(() => {
        if (selectedTextbook) {
            localStorage.setItem(`annotations_${selectedTextbook.name}`, JSON.stringify(annotations));
        }
    }, [annotations, selectedTextbook]);

    const drawAnnotations = useCallback(() => {
        const canvas = annotationCanvasRef.current;
        const ctx = getContext(canvas);
        if (!ctx || !canvas) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
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
        
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1.0;
    }, [annotations, currentPage, zoom]);

    useEffect(() => {
        drawAnnotations();
    }, [zoom, currentPage, drawAnnotations]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.type === 'application/pdf') onAddTextbook(file);
    };
    
    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!selectedTextbook) return;
        setIsDrawing(true);
        const { offsetX, offsetY } = e.nativeEvent;
        
        const newAnnotation: Annotation = { 
            tool, 
            color, 
            points: [{ x: offsetX / zoom, y: offsetY / zoom }]
        };
        
        setAnnotations(prev => ({
            ...prev, 
            [currentPage]: [...(prev[currentPage] || []), newAnnotation]
        }));
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing || !selectedTextbook) return;
        
        const canvas = annotationCanvasRef.current;
        const ctx = getContext(canvas);
        if (!ctx || !canvas) return;
        
        const { offsetX, offsetY } = e.nativeEvent;
        const currentAnns = annotations[currentPage];
        if (!currentAnns || currentAnns.length === 0) return;

        const lastAnn = currentAnns[currentAnns.length - 1];
        
        const newPoint = { x: offsetX / zoom, y: offsetY / zoom };
        lastAnn.points.push(newPoint);
        
        ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
        ctx.strokeStyle = lastAnn.color;
        ctx.lineWidth = tool === 'highlighter' ? 10 : (tool === 'eraser' ? 15 : 3);
        ctx.globalAlpha = tool === 'highlighter' ? 0.3 : 1.0;
        
        ctx.beginPath();
        const points = lastAnn.points;
        if (points.length > 1) {
             const prevPoint = points[points.length - 2];
             ctx.moveTo(prevPoint.x * zoom, prevPoint.y * zoom);
             ctx.lineTo(newPoint.x * zoom, newPoint.y * zoom);
             ctx.stroke();
        }
    };
    
    const stopDrawing = () => {
        if (!isDrawing) return;
        setIsDrawing(false);
        setAnnotations(prev => ({...prev}));
        drawAnnotations();
    };

    const onDocumentLoadSuccess = ({ numPages: nextNumPages }: { numPages: number }) => {
        setNumPages(nextNumPages);
        if(currentPage > nextNumPages) {
            setCurrentPage(nextNumPages);
        }
    };

    const onPageRenderSuccess = () => {
        const pdfCanvas = annotationCanvasRef.current?.previousElementSibling?.querySelector('canvas');
        if (pdfCanvas) {
            const { width, height } = pdfCanvas.getBoundingClientRect();
            setCanvasSize({ width, height });
            drawAnnotations();
        }
    };
    
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
    
    const Pagination: React.FC = () => (
        <div className="flex items-center gap-4 p-2 bg-gray-100 dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="px-3 py-1 rounded disabled:opacity-50 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors font-bold">&lt;</button>
            <span>Стр. {currentPage} из {numPages || 0}</span>
            <button onClick={() => setCurrentPage(Math.min(numPages, currentPage + 1))} disabled={currentPage === numPages || numPages === 0} className="px-3 py-1 rounded disabled:opacity-50 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors font-bold">&gt;</button>
        </div>
    );

    return (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md h-full flex flex-col">
            <div className="flex-shrink-0 mb-4 flex items-center justify-between gap-4">
                 <div className="flex-1">
                    <select
                        value={selectedTextbook?.name || ''}
                        onChange={(e) => setSelectedTextbook(textbooks.find(tb => tb.name === e.target.value) || null)}
                        className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={textbooks.length === 0}
                    >
                        {textbooks.length === 0 && <option>Загрузите учебник</option>}
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
                    <div className="flex justify-center mb-4"><Toolbar /></div>
                    
                    <div className="flex-grow overflow-auto flex justify-center bg-gray-200 dark:bg-gray-900">
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
                                    onRenderSuccess={onPageRenderSuccess}
                                    renderAnnotationLayer={false}
                                    renderTextLayer={false}
                                />
                            </Document>
                            
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
                <div className="flex-grow flex items-center justify-center text-center text-gray-500 dark:text-gray-400">
                    <p>Пожалуйста, загрузите PDF-файл, чтобы начать работу.</p>
                </div>
            )}
        </div>
    );
};

export default Textbook;