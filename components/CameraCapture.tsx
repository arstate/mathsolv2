import React, { useRef, useState, useEffect } from 'react';
import { Button } from './Button';

interface CameraCaptureProps {
  onCapture: (imageData: string) => void;
  onCancel: () => void;
}

interface ZoomCapabilities {
  min: number;
  max: number;
  step: number;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, onCancel }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string>('');
  
  // Zoom State
  const [zoom, setZoom] = useState<number>(1);
  const [zoomCap, setZoomCap] = useState<ZoomCapabilities | null>(null);
  
  // Pinch Gesture State
  const [pinchStartDist, setPinchStartDist] = useState<number>(0);
  const [pinchStartZoom, setPinchStartZoom] = useState<number>(1);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      const constraints = {
        video: {
          facingMode: { ideal: 'environment' }, // Prefer back camera
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      };
      
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      // Check Zoom Capabilities
      const track = mediaStream.getVideoTracks()[0];
      // Type assertion because getCapabilities isn't always fully typed in all TS envs
      const capabilities = (track.getCapabilities ? track.getCapabilities() : {}) as any;

      if (capabilities.zoom) {
        setZoomCap({
          min: capabilities.zoom.min,
          max: capabilities.zoom.max,
          step: capabilities.zoom.step
        });
        setZoom(capabilities.zoom.min);
      }

    } catch (err) {
      console.error("Camera Error:", err);
      setError("Tidak dapat mengakses kamera. Pastikan izin diberikan.");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const handleZoom = (value: number) => {
    if (!stream || !zoomCap) return;
    
    // Clamp value
    const newZoom = Math.min(Math.max(value, zoomCap.min), zoomCap.max);
    setZoom(newZoom);

    const track = stream.getVideoTracks()[0];
    const constraints = { advanced: [{ zoom: newZoom }] } as any;
    
    track.applyConstraints(constraints).catch(err => {
      console.log("Zoom not supported directly:", err);
    });
  };

  // --- Pinch to Zoom Logic ---

  const getPinchDistance = (e: React.TouchEvent) => {
    if (e.touches.length < 2) return 0;
    const t1 = e.touches[0];
    const t2 = e.touches[1];
    // Pythagoras theorem
    return Math.sqrt(
      Math.pow(t1.clientX - t2.clientX, 2) + 
      Math.pow(t1.clientY - t2.clientY, 2)
    );
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      setPinchStartDist(getPinchDistance(e));
      setPinchStartZoom(zoom);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && zoomCap) {
      const currentDist = getPinchDistance(e);
      if (pinchStartDist > 0) {
        // Sensitivity factor
        const scale = currentDist / pinchStartDist;
        // Calculate raw zoom change
        // We map the pinch ratio to the zoom range roughly
        const range = zoomCap.max - zoomCap.min;
        const delta = (scale - 1) * range * 0.5; // 0.5 is sensitivity dampener
        
        handleZoom(pinchStartZoom + delta);
      }
    }
  };

  // --- Capture ---

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        stopCamera();
        onCapture(imageData);
      }
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="text-red-500 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
        </div>
        <p className="text-gray-800 font-medium mb-6">{error}</p>
        <Button onClick={onCancel}>Kembali</Button>
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 bg-black z-50 flex flex-col touch-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
    >
      <div className="relative flex-1 bg-black overflow-hidden">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          className="absolute top-0 left-0 w-full h-full object-cover"
        />
        
        {/* Overlay Grid */}
        <div className="absolute inset-0 pointer-events-none opacity-30">
            <div className="w-full h-full border-2 border-white/50 relative">
                <div className="absolute top-1/3 w-full h-px bg-white/50"></div>
                <div className="absolute top-2/3 w-full h-px bg-white/50"></div>
                <div className="absolute left-1/3 h-full w-px bg-white/50"></div>
                <div className="absolute left-2/3 h-full w-px bg-white/50"></div>
            </div>
        </div>

        {/* Zoom Feedback Overlay (Optional) */}
        {zoomCap && (
           <div className="absolute top-4 right-4 bg-black/50 text-white px-2 py-1 rounded text-sm font-mono pointer-events-none">
             {zoom.toFixed(1)}x
           </div>
        )}
      </div>

      <div className="bg-gray-900 p-6 pb-8 pt-2 flex flex-col items-center gap-4">
        
        {/* Zoom Slider */}
        {zoomCap && (
          <div className="w-full max-w-xs flex items-center gap-3 px-4 mb-2">
             <span className="text-white text-xs">1x</span>
             <input 
                type="range" 
                min={zoomCap.min} 
                max={zoomCap.max} 
                step={zoomCap.step || 0.1}
                value={zoom}
                onChange={(e) => handleZoom(parseFloat(e.target.value))}
                className="flex-1 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-indigo-500"
             />
             <span className="text-white text-xs">{zoomCap.max}x</span>
          </div>
        )}

        <div className="flex items-center justify-between w-full">
            <button 
                onClick={onCancel}
                className="text-white p-4 rounded-full hover:bg-white/10"
            >
                Batal
            </button>
            
            <button 
                onClick={handleCapture}
                className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center bg-white/20 active:scale-95 transition-transform"
            >
                <div className="w-16 h-16 bg-white rounded-full"></div>
            </button>

            <div className="w-12"></div> {/* Spacer for alignment */}
        </div>
      </div>
      
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};