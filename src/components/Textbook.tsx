import React, { useRef, useCallback, useEffect, useState } from 'react';
import { UploadIcon, PenIcon, EraserIcon, HighlighterIcon, ZoomInIcon, ZoomOutIcon } from './Icons';
import type { Annotation, AnnotationPoint, Tool, TextbookFile } from '../types';

// pdfjsLib will be available on the window object from the CDN script
declare const window: any;

interface TextbookProps {
    textbooks: TextbookFile[];
    selectedTextbook: TextbookFile | null;
    setSelectedTextbook: (book: TextbookFile | null) => void;
    onAddTextbook: (file: File) => void;
    numPages: number;
    setNumPages: (count: number) => void;
    currentPage: number;
    // Fix: Update type to allow functional updates for state, resolving errors on lines 192 and 194.
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
    
    // Load annotations from localStorage
    useEffect(() => {
        if (selectedTextbook) {
            const saved = localStorage.getItem(`annotations_${selectedTextbook.file.name}`);
            if (saved) {
                setAnnotations(JSON.parse(saved));
            } else {
                setAnnotations({});
            }
        }
    }, [selectedTextbook, setAnnotations]);

    // Save annotations to localStorage
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

            ann.points.forEach((p, i) => {
                if (i === 0) ctx.moveTo(p.x, p.y);
                else ctx.lineTo(p.x, p.y);
            });
            ctx.stroke();
            ctx.closePath();
        });
        
        // Reset composite operation for future drawing
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
    }, [selectedTextbook, currentPage, zoom, numPages, setNumPages, drawAnnotations]);

    useEffect(() => {
        renderPage();
    }, [renderPage]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.type === 'application/pdf') {
            onAddTextbook(file);
        }
    };
    
    // --- Drawing Handlers ---
    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = annotationCanvasRef.current;
        if (!canvas) return;
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

        const currentAnns = annotations[currentPage] || [];
        if (currentAnns.length === 0) return;

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
        ctx.closePath();
        
        // No need to call setAnnotations here, we are mutating the draft
    };
    
    const stopDrawing = () => {
        setIsDrawing(false);
        // Trigger a re-save to localStorage by creating a new object
        setAnnotations(prev => ({...prev}));
    };

    const Toolbar: React.FC = () => (
         <div className="flex items-center gap-4 p-2 bg-gray-100 dark:bg-gray-900 rounded-lg">
            <button onClick={() => setTool('pen')} className={tool === 'pen' ? 'text-blue-500' : ''}><PenIcon className="w-6 h-6"/></button>
            <button onClick={() => setTool('highlighter')} className={tool === 'highlighter' ? 'text-blue-500' : ''}><HighlighterIcon className="w-6 h-6"/></button>
            <button onClick={() => setTool('eraser')} className={tool === 'eraser' ? 'text-blue-500' : ''}><EraserIcon className="w-6 h-6"/></button>
            <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-8 h-8 cursor-pointer" disabled={tool === 'eraser'}/>
            <div className="flex items-center gap-2">
               <button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}><ZoomOutIcon className="w-6 h-6"/></button>
                <span>{Math.round(zoom * 100)}%</span>
               <button onClick={() => setZoom(z => Math.min(3, z + 0.25))}><ZoomInIcon className="w-6 h-6"/></button>
            </div>
        </div>
    );
    
    const Pagination: React.FC = () => (
        <div className="flex items-center gap-4 p-2 bg-gray-100 dark:bg-gray-900 rounded-lg">
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-2 rounded disabled:opacity-50">&lt;</button>
            <span>Стр. {currentPage} из {numPages}</span>
            <button onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))} disabled={currentPage === numPages} className="px-2 rounded disabled:opacity-50">&gt;</button>
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