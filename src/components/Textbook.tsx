import React, { useRef, useCallback, useEffect, useState } from 'react';
import { UploadIcon, PenIcon, EraserIcon, HighlighterIcon, ZoomInIcon, ZoomOutIcon } from './Icons';
import type { Annotation, Tool, TextbookFile } from '../types';

declare const window: any;

interface TextbookProps {
    textbooks: TextbookFile[];
    selectedTextbook: TextbookFile | null;
    setSelectedTextbook: (book: TextbookFile | null) => void;
    onAddTextbook: (file: File) => void;
    numPages: number;
    setNumPages: (count: number) => void;
    currentPage: number;
    setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
    zoom: number;
    setZoom: React.Dispatch<React.SetStateAction<number>>;
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
    zoom, setZoom, tool, setTool, color, setColor,
    annotations, setAnnotations
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const annotationCanvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const getContext = (canvas: HTMLCanvasElement | null) => canvas?.getContext('2d');
    
    useEffect(() => {
        if (selectedTextbook) {
            const saved = localStorage.getItem(`annotations_${selectedTextbook.file.name}`);
            if (saved) setAnnotations(JSON.parse(saved));
            else setAnnotations({});
        }
    }, [selectedTextbook, setAnnotations]);

    useEffect(() => {
        if (selectedTextbook) {
            localStorage.setItem(`annotations_${selectedTextbook.file.name}`, JSON.stringify(annotations));
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
            ctx.lineWidth = ann.tool === 'highlighter' ? 10 : 3;
            ctx.globalAlpha = ann.tool === 'highlighter' ? 0.3 : 1.0;
            ctx.globalCompositeOperation = 'source-over';
            ann.points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
            ctx.stroke();
        });
        
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1.0;
    }, [annotations, currentPage]);

    const renderPage = useCallback(async () => {
        if (!selectedTextbook || !window.pdfjsLib) return;

        try {
            const pdf = await window.pdfjsLib.getDocument(selectedTextbook.url).promise;
            if (pdf.numPages !== numPages) setNumPages(pdf.numPages);
            
            const page = await pdf.getPage(currentPage);
            const viewport = page.getViewport({ scale: zoom });
            
            const canvas = canvasRef.current;
            const annotationCanvas = annotationCanvasRef.current;
            if (canvas && annotationCanvas) {
                const context = getContext(canvas);
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                annotationCanvas.height = viewport.height;
                annotationCanvas.width = viewport.width;

                if (context) {
                    await page.render({ canvasContext: context, viewport }).promise;
                    drawAnnotations();
                }
            }
        } catch (error) {
            console.error("Error rendering PDF:", error);
        }
        // Убрана зависимость numPages, чтобы предотвратить цикл перерисовки
    }, [selectedTextbook, currentPage, zoom, setNumPages, drawAnnotations]);

    useEffect(() => {
        renderPage();
    }, [renderPage]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.type === 'application/pdf') onAddTextbook(file);
    };
    
    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
        setIsDrawing(true);
        const { offsetX, offsetY } = e.nativeEvent;
        const newAnnotation: Annotation = { tool, color, points: [{ x: offsetX, y: offsetY }] };
        setAnnotations(prev => ({...prev, [currentPage]: [...(prev[currentPage] || []), newAnnotation]}));
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;
        const canvas = annotationCanvasRef.current;
        const ctx = getContext(canvas);
        if (!ctx || !canvas) return;
        
        const { offsetX, offsetY } = e.nativeEvent;
        const currentAnns = annotations[currentPage];
        if (!currentAnns || currentAnns.length === 0) return;

        const lastAnn = currentAnns[currentAnns.length-1];
        lastAnn.points.push({ x: offsetX, y: offsetY });
        
        ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
        ctx.strokeStyle = lastAnn.color;
        ctx.lineWidth = tool === 'highlighter' ? 10 : (tool === 'eraser' ? 15 : 3);
        ctx.globalAlpha = tool === 'highlighter' ? 0.3 : 1.0;
        
        ctx.beginPath();
        const points = lastAnn.points;
        if(points.length > 1) {
             ctx.moveTo(points[points.length-2].x, points[points.length-2].y);
             ctx.lineTo(points[points.length-1].x, points[points.length-1].y);
             ctx.stroke();
        }
    };
    
    const stopDrawing = () => {
        setIsDrawing(false);
        setAnnotations(prev => ({...prev}));
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
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1 rounded disabled:opacity-50 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors font-bold">&lt;</button>
            <span>Стр. {currentPage} из {numPages}</span>
            <button onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))} disabled={currentPage === numPages} className="px-3 py-1 rounded disabled:opacity-50 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors font-bold">&gt;</button>
        </div>
    );

    return (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md h-full flex flex-col">
            <div className="flex-shrink-0 mb-4 flex items-center justify-between gap-4">
                 <div className="flex-1">
                    <select
                        value={selectedTextbook?.file.name || ''}
                        onChange={(e) => setSelectedTextbook(textbooks.find(tb => tb.file.name === e.target.value) || null)}
                        className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={textbooks.length === 0}
                    >
                        {textbooks.length === 0 && <option>Загрузите учебник</option>}
                        {textbooks.map(tb => <option key={tb.file.name} value={tb.file.name}>{tb.file.name}</option>)}
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
                    <div className="flex-grow my-4 overflow-auto pr-2 flex justify-center bg-gray-200 dark:bg-gray-900 rounded-md">
                        <div className="relative" style={{ width: canvasRef.current?.width, height: canvasRef.current?.height }}>
                            <canvas ref={canvasRef} />
                            <canvas 
                                ref={annotationCanvasRef} 
                                className="absolute top-0 left-0 cursor-crosshair"
                                onMouseDown={startDrawing}
                                onMouseMove={draw}
                                onMouseUp={stopDrawing}
                                onMouseLeave={stopDrawing}
                            />
                        </div>
                    </div>
                    {numPages > 1 && <div className="flex justify-center mt-auto"><Pagination /></div>}
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