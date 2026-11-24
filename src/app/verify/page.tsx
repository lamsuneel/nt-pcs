'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import jsQR from 'jsqr';

export default function VerifyEntryPage() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [showManual, setShowManual] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const foundRef = useRef(false);

  function stopScan() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }

  useEffect(() => stopScan, []);

  async function startScan() {
    setCameraError('');
    foundRef.current = false;
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("This browser can't access the camera here — use manual entry instead.");
      setShowManual(true);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      setScanning(true);
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      tick();
    } catch (err) {
      setCameraError('Camera access was denied or is unavailable. Use manual entry instead.');
      setShowManual(true);
      setScanning(false);
    }
  }

  function tick() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || foundRef.current) return;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
        if (code?.data) {
          foundRef.current = true;
          stopScan();
          const value = code.data.trim();
          // Accept either a bare token or a full verify URL encoded in the QR.
          const match = value.match(/\/verify\/([^/?#]+)/);
          router.push(`/verify/${match ? match[1] : encodeURIComponent(value)}`);
          return;
        }
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }

  function go(e: React.FormEvent) {
    e.preventDefault();
    if (token.trim()) router.push(`/verify/${token.trim()}`);
  }

  return (
    <div className="min-h-screen bg-nt-bg flex items-center justify-center px-4 font-sans">
      <div className="w-full max-w-sm text-center">
        <img src="/brand/nt-logo-mark.png" alt="PrintAssure" className="w-10 h-10 rounded-lg object-contain mx-auto mb-4" />
        <h1 className="font-display text-lg text-nt-text mb-1">Scan a controlled copy</h1>
        <p className="text-nt-muted text-sm mb-6">Point your camera at the QR code on a controlled copy.</p>

        <div className="nt-card p-3 mb-4 overflow-hidden">
          <div className={`relative rounded-lg overflow-hidden bg-black ${scanning ? '' : 'aspect-square flex items-center justify-center'}`}>
            <video ref={videoRef} playsInline muted className={scanning ? 'w-full h-auto' : 'hidden'} />
            {!scanning && <span className="text-nt-muted text-xs">Camera preview appears here</span>}
            {scanning && (
              <div className="pointer-events-none absolute inset-6 border-2 border-nt-tealBright/80 rounded-xl" />
            )}
          </div>
        </div>
        <canvas ref={canvasRef} className="hidden" />

        {cameraError && <div className="text-nt-blocked text-xs mb-3">{cameraError}</div>}

        {!scanning ? (
          <button onClick={startScan} className="w-full rounded-pill bg-nt-teal text-nt-bg py-2.5 text-sm font-medium">
            Open camera to scan
          </button>
        ) : (
          <button onClick={stopScan} className="w-full rounded-pill bg-nt-panel2 border border-nt-border text-nt-text py-2.5 text-sm font-medium">
            Stop scanning
          </button>
        )}

        <button
          onClick={() => setShowManual((s) => !s)}
          className="mt-3 text-xs text-nt-muted hover:text-nt-text underline"
        >
          {showManual ? 'Hide manual entry' : "Can't use the camera? Enter the code manually"}
        </button>

        {showManual && (
          <form onSubmit={go} className="space-y-3 mt-4">
            <input
              className="nt-input text-center"
              placeholder="QR code value"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              autoFocus
            />
            <button className="w-full rounded-pill bg-nt-panel2 border border-nt-border text-nt-text py-2.5 text-sm font-medium">
              Check validity
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
