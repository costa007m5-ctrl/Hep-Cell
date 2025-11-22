
import React, { useRef, useState, useEffect } from 'react';

interface SignaturePadProps {
    onEnd: (imageData: string | null) => void;
}

const SignaturePad: React.FC<SignaturePadProps> = ({ onEnd }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasSignature, setHasSignature] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas) {
            // Ajusta resolução para telas retina/mobile
            const ratio = Math.max(window.devicePixelRatio || 1, 1);
            canvas.width = canvas.offsetWidth * ratio;
            canvas.height = canvas.offsetHeight * ratio;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.scale(ratio, ratio);
                ctx.lineWidth = 2;
                ctx.lineCap = 'round';
                ctx.strokeStyle = '#000000';
            }
        }
    }, []);

    const getCoords = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        
        const rect = canvas.getBoundingClientRect();
        let clientX, clientY;

        if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = (e as React.MouseEvent).clientX;
            clientY = (e as React.MouseEvent).clientY;
        }

        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    };

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault(); // Previne scroll em touch devices
        setIsDrawing(true);
        const ctx = canvasRef.current?.getContext('2d');
        const { x, y } = getCoords(e);
        ctx?.beginPath();
        ctx?.moveTo(x, y);
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        if (!isDrawing) return;
        const ctx = canvasRef.current?.getContext('2d');
        const { x, y } = getCoords(e);
        ctx?.lineTo(x, y);
        ctx?.stroke();
        if (!hasSignature) setHasSignature(true);
    };

    const endDrawing = () => {
        setIsDrawing(false);
        if (canvasRef.current && hasSignature) {
            onEnd(canvasRef.current.toDataURL());
        }
    };

    const clear = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height); // Limpa usando as dimensões internas reais
            setHasSignature(false);
            onEnd(null);
        }
    };

    return (
        <div className="space-y-2">
            <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl bg-white touch-none relative overflow-hidden">
                <canvas
                    ref={canvasRef}
                    className="w-full h-40 block"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={endDrawing}
                    onMouseLeave={endDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={endDrawing}
                />
                {!hasSignature && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-400 text-sm">
                        Assine aqui
                    </div>
                )}
            </div>
            <button 
                type="button" 
                onClick={clear} 
                className="text-xs text-red-500 hover:text-red-600 font-medium flex items-center gap-1"
                disabled={!hasSignature}
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                Limpar Assinatura
            </button>
        </div>
    );
};

export default SignaturePad;
