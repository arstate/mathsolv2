import React, { useRef, useState, useEffect } from 'react';
import { Button } from './Button';

interface CameraCaptureProps {
  onCapture: (imageData: string) => void;
  onCancel: () => void;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, onCancel }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string>('');

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
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
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
      </div>

      <div className="bg-gray-900 p-6 pb-8 flex items-center justify-between">
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
      
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};