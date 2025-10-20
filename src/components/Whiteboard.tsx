import React, { useState, useEffect, useRef, memo } from 'react';

const Whiteboard: React.FC = memo(() => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [color, setColor] = useState('#000000');

    const getContext = () => canvasRef.current?.getContext('2d');

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const ctx = getContext();
        if (!ctx) return;
        setIsDrawing(true);
        ctx.beginPath();
        ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;
        const ctx = getContext();
        if (!ctx) return;
        ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
        ctx.stroke();
    };

    const stopDrawing = () => {
        const ctx = getContext();
        if (!ctx) return;
        ctx.closePath();
        setIsDrawing(false);
    };
    
    const clearCanvas = () => {
        const canvas = canvasRef.current;
        const ctx = getContext();
        if(canvas && ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }

    useEffect(() => {
        const ctx = getContext();
        if (ctx) {
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
        }
    }, [color]);
    
    useEffect(() => {
        const canvas = canvasRef.current;
        let context: CanvasRenderingContext2D | null = null;

        const resizeCanvas = () => {
             if (canvas) {
                // Save drawing state before resize
                const imageData = context?.getImageData(0, 0, canvas.width, canvas.height);
                
                canvas.width = canvas.offsetWidth;
                canvas.height = canvas.offsetHeight;
                
                // Restore drawing state after resize
                if (context && imageData) {
                    context.putImageData(imageData, 0, 0);
                }
                // Re-apply styles as context is reset on resize
                if (context) {
                    context.strokeStyle = color;
                    context.lineWidth = 3;
                }
            }
        }
        
        if (canvas) {
            context = canvas.getContext('2d');
        }

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        return () => window.removeEventListener('resize', resizeCanvas);
    }, [color]); // Add color to dependency array to re-apply color style on resize

    return (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-800 dark:text-white">Доска</h3>
                <div className="flex items-center gap-4">
                    <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-8 h-8" />
                    <button onClick={clearCanvas} className="bg-red-500 text-white px-3 py-1 rounded-md text-sm hover:bg-red-600">Очистить</button>
                </div>
            </div>
            <div className="flex-grow w-full h-full border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <canvas
                    ref={canvasRef}
                    className="w-full h-full bg-gray-50 dark:bg-gray-900 cursor-crosshair"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                />
            </div>
        </div>
    );
});


export default Whiteboard;