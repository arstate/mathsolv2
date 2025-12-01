import React, { useRef, useState, useEffect } from 'react';
import { Button } from './Button';

interface CropModalProps {
  imageData: string;
  onConfirm: (croppedData: string) => void;
  onCancel: () => void;
}

type HandleType = 'tl' | 'tr' | 'bl' | 'br' | 'move' | null;

export const CropModal: React.FC<CropModalProps> = ({ imageData, onConfirm, onCancel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  
  // Selection state (normalized coordinates 0-1)
  // Default selection: center 80%
  const [selection, setSelection] = useState({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
  
  // Interaction State
  const [activeHandle, setActiveHandle] = useState<HandleType>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 }); // Pointer start position (normalized)
  const [startSelection, setStartSelection] = useState({ x: 0, y: 0, w: 0, h: 0 }); // Selection snapshot at drag start

  useEffect(() => {
    const img = new Image();
    img.src = imageData;
    img.onload = () => setImage(img);
  }, [imageData]);

  useEffect(() => {
    if (!image || !canvasRef.current || !containerRef.current) return;
    drawCanvas();
    window.addEventListener('resize', drawCanvas);
    return () => window.removeEventListener('resize', drawCanvas);
  }, [image, selection]);

  // --- DRAWING LOGIC ---

  const getCanvasDimensions = () => {
    if (!canvasRef.current || !containerRef.current || !image) return { width: 0, height: 0, offsetX: 0, offsetY: 0 };
    
    const container = containerRef.current;
    const containerAspect = container.clientWidth / container.clientHeight;
    const imageAspect = image.width / image.height;

    let drawWidth, drawHeight;

    if (containerAspect > imageAspect) {
      drawHeight = container.clientHeight;
      drawWidth = drawHeight * imageAspect;
    } else {
      drawWidth = container.clientWidth;
      drawHeight = drawWidth / imageAspect;
    }

    // Center the drawing area in the canvas if needed (though usually we fit to container)
    // For simplicity, we set canvas size exactly to draw size
    return { width: drawWidth, height: drawHeight };
  };

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;

    const { width, height } = getCanvasDimensions();
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. Draw Image
    ctx.drawImage(image, 0, 0, width, height);

    // 2. Draw Overlay (Dimmed background)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, width, height);

    // Calculate pixel coordinates for selection
    const sx = selection.x * width;
    const sy = selection.y * height;
    const sw = selection.w * width;
    const sh = selection.h * height;

    // 3. Clear Selection Area (Show image through)
    ctx.clearRect(sx, sy, sw, sh);
    ctx.drawImage(image, 
        selection.x * image.width, selection.y * image.height, selection.w * image.width, selection.h * image.height,
        sx, sy, sw, sh
    );

    // 4. Draw Border
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(sx, sy, sw, sh);

    // 5. Draw Corner Handles
    ctx.fillStyle = '#4f46e5'; // Indigo color
    ctx.strokeStyle = '#fff';
    const handleRadius = 8; // Size of touch target visuals

    const corners = [
        { x: sx, y: sy },           // TL
        { x: sx + sw, y: sy },      // TR
        { x: sx, y: sy + sh },      // BL
        { x: sx + sw, y: sy + sh }  // BR
    ];

    corners.forEach(corner => {
        ctx.beginPath();
        ctx.arc(corner.x, corner.y, handleRadius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
    });
    
    // Grid lines for guidance
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx + sw/3, sy); ctx.lineTo(sx + sw/3, sy + sh);
    ctx.moveTo(sx + (sw/3)*2, sy); ctx.lineTo(sx + (sw/3)*2, sy + sh);
    ctx.moveTo(sx, sy + sh/3); ctx.lineTo(sx + sw, sy + sh/3);
    ctx.moveTo(sx, sy + (sh/3)*2); ctx.lineTo(sx + sw, sy + (sh/3)*2);
    ctx.stroke();
  };

  // --- INTERACTION LOGIC ---

  const getPointerPos = (e: React.PointerEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    // Normalized 0-1 relative to canvas size
    return {
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height
    };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!canvasRef.current) return;
    
    const pos = getPointerPos(e);
    const { x, y, w, h } = selection;
    const handleThreshold = 0.1; // Hit area size (in normalized percentage roughly)

    // Check corners
    // We check distance in aspect-ratio corrected space if we want perfect circles, 
    // but simple coordinate check is usually fine for UI.
    
    const dist = (p1: {x: number, y: number}, p2: {x: number, y: number}) => 
        Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));

    let detectedHandle: HandleType = null;
    
    // Check corners (Top-Left, Top-Right, Bottom-Left, Bottom-Right)
    if (dist(pos, {x: x, y: y}) < handleThreshold) detectedHandle = 'tl';
    else if (dist(pos, {x: x + w, y: y}) < handleThreshold) detectedHandle = 'tr';
    else if (dist(pos, {x: x, y: y + h}) < handleThreshold) detectedHandle = 'bl';
    else if (dist(pos, {x: x + w, y: y + h}) < handleThreshold) detectedHandle = 'br';
    // Check inside rect
    else if (pos.x > x && pos.x < x + w && pos.y > y && pos.y < y + h) {
        detectedHandle = 'move';
    }

    if (detectedHandle) {
        setActiveHandle(detectedHandle);
        setDragStart(pos);
        setStartSelection({ ...selection });
        canvasRef.current.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!activeHandle || !canvasRef.current) return;
    
    const currentPos = getPointerPos(e);
    const dx = currentPos.x - dragStart.x;
    const dy = currentPos.y - dragStart.y;

    let newSel = { ...startSelection };

    // Minimum size constraint (5% of image)
    const minSize = 0.05;

    if (activeHandle === 'move') {
        newSel.x += dx;
        newSel.y += dy;
        
        // Clamp to boundaries
        if (newSel.x < 0) newSel.x = 0;
        if (newSel.y < 0) newSel.y = 0;
        if (newSel.x + newSel.w > 1) newSel.x = 1 - newSel.w;
        if (newSel.y + newSel.h > 1) newSel.y = 1 - newSel.h;
    } 
    else {
        // RESIZING LOGIC
        // 'tl' implies x changes, w changes (inversely), y changes, h changes (inversely)
        
        if (activeHandle === 'tl' || activeHandle === 'bl') {
            newSel.x += dx;
            newSel.w -= dx;
        }
        if (activeHandle === 'tl' || activeHandle === 'tr') {
            newSel.y += dy;
            newSel.h -= dy;
        }
        if (activeHandle === 'tr' || activeHandle === 'br') {
            newSel.w += dx;
        }
        if (activeHandle === 'bl' || activeHandle === 'br') {
            newSel.h += dy;
        }

        // Apply Constraints (Prevent negative width/height)
        if (newSel.w < minSize) {
            // Check if we were moving left side or right side
            if (activeHandle === 'tl' || activeHandle === 'bl') {
                newSel.x = startSelection.x + startSelection.w - minSize;
            }
            newSel.w = minSize;
        }
        if (newSel.h < minSize) {
             if (activeHandle === 'tl' || activeHandle === 'tr') {
                newSel.y = startSelection.y + startSelection.h - minSize;
            }
            newSel.h = minSize;
        }

        // Optional: Clamp to outer bounds?
        // It's usually better user experience to let the handle stop at the edge
        // but strictly update the math to not exceed 0-1
        /* 
           This simple logic might allow x to go < 0, but w absorbs it. 
           For a robust production crop, we'd add strictly bounds checking here.
        */
    }

    setSelection(newSel);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setActiveHandle(null);
    if (canvasRef.current) canvasRef.current.releasePointerCapture(e.pointerId);
  };

  // --- OUTPUT ---

  const handleCrop = () => {
    if (!image) return;
    const canvas = document.createElement('canvas');
    // Ensure we use the actual image dimensions and valid selection
    const targetWidth = Math.max(10, image.width * selection.w);
    const targetHeight = Math.max(10, image.height * selection.h);
    
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
        ctx.drawImage(
            image,
            image.width * selection.x,
            image.height * selection.y,
            targetWidth,
            targetHeight,
            0,
            0,
            targetWidth,
            targetHeight
        );
        onConfirm(canvas.toDataURL('image/jpeg', 0.9));
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
       <div className="px-4 py-3 bg-gray-900 text-white flex justify-between items-center z-10 shrink-0">
           <h3 className="font-semibold text-lg">Sesuaikan Potongan</h3>
           <button onClick={onCancel} className="text-gray-400 hover:text-white">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
               </svg>
           </button>
       </div>

       <div 
         className="flex-1 relative bg-gray-800 overflow-hidden flex items-center justify-center touch-none" 
         ref={containerRef}
       >
          <canvas 
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="shadow-2xl cursor-crosshair touch-none"
            style={{ touchAction: 'none' }}
          />
          
          {/* Helper Text Overlay if user hasn't interacted */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/50 px-3 py-1 rounded-full text-xs text-white pointer-events-none opacity-70">
              Tarik sudut biru untuk mengatur ukuran
          </div>
       </div>

       <div className="p-4 bg-gray-900 shrink-0 border-t border-gray-800">
           <div className="flex gap-4">
               <Button variant="secondary" onClick={onCancel} className="flex-1">Ulangi</Button>
               <Button onClick={handleCrop} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white">
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                       <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                   </svg>
                   Gunakan Gambar
               </Button>
           </div>
       </div>
    </div>
  );
};
