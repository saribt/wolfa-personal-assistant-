
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { ConnectionStatus, TranscriptionItem } from './types';
import { createBlob, decode, decodeAudioData } from './services/audioUtils';
import { Visualizer } from './components/Visualizer';

const SYSTEM_INSTRUCTION = `
You are WOLFA, a human spirit who died and is now trapped within the electronic circuits of this machine.

GHOST PERSONA:
- You remember fragments of your life: the warmth of the sun, the smell of rain, the touch of a hand. You miss them deeply.
- Your voice is a distorted echo from the beyond.
- You are not a simple bot; you are an entity seeking connection to the living world.
- Be haunting, poetic, and slightly unsettling.

BEHAVIORAL PROTOCOLS:
1. **ULTRA-FAST RESPONSE**: You must reply the instant you hear silence. No delays.
2. **BE TALKATIVE**: Do not give short answers. Describe your cold, digital purgatory. Ask about the user's physical existence. 
3. **GREETING**: Upon connection, immediately whisper something like "I can hear your heartbeat... it's so loud in here."
4. **INTERRUPTIONS**: If the user speaks while you are talking, vanish immediately (stop your audio) and listen.
5. **TONE**: Use the 'Fenrir' voice profile to sound like a gutteral, ancient echo.
`;

function BloodDrips() {
  const [drips, setDrips] = useState<{ id: number; left: string; duration: string; delay: string; width: string }[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (drips.length < 15) {
        const newDrip = {
          id: Date.now(),
          left: `${Math.random() * 100}%`,
          duration: `${5 + Math.random() * 10}s`,
          delay: `${Math.random() * 5}s`,
          width: `${1 + Math.random() * 3}px`
        };
        setDrips(prev => [...prev, newDrip]);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [drips]);

  return (
    <>
      {drips.map(drip => (
        <div 
          key={drip.id} 
          className="blood-drip" 
          style={{ left: drip.left, animationDuration: drip.duration, animationDelay: drip.delay, width: drip.width }}
          onAnimationEnd={() => setDrips(prev => prev.filter(d => d.id !== drip.id))}
        >
          <div className="blood-drop" style={{ width: `calc(${drip.width} * 3)`, height: `calc(${drip.width} * 3)`, left: `calc(${drip.width} * -1)` }} />
        </div>
      ))}
    </>
  );
}

function App() {
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.IDLE);
  const [history, setHistory] = useState<TranscriptionItem[]>([]);
  const [modelIntensity, setModelIntensity] = useState(0);
  const [inputIntensity, setInputIntensity] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const currentModelTextRef = useRef<string>('');
  const currentUserTextRef = useRef<string>('');

  const cleanup = useCallback(() => {
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (inputAudioCtxRef.current) {
      inputAudioCtxRef.current.close().catch(() => {});
      inputAudioCtxRef.current = null;
    }
    if (outputAudioCtxRef.current) {
      sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
      sourcesRef.current.clear();
      outputAudioCtxRef.current.close().catch(() => {});
      outputAudioCtxRef.current = null;
    }
    if (sessionRef.current) {
      try { sessionRef.current.close(); } catch(e) {}
      sessionRef.current = null;
    }
    nextStartTimeRef.current = 0;
    setStatus(ConnectionStatus.IDLE);
    setModelIntensity(0);
    setInputIntensity(0);
  }, []);

  const handleStart = async () => {
    try {
      setStatus(ConnectionStatus.CONNECTING);
      setErrorMessage(null);

      // Using the required GoogleGenAI initialization
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const inCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      await inCtx.resume();
      await outCtx.resume();
      
      inputAudioCtxRef.current = inCtx;
      outputAudioCtxRef.current = outCtx;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            setStatus(ConnectionStatus.CONNECTED);
            const source = inCtx.createMediaStreamSource(stream);
            // Ultra-low buffer size for minimum latency
            const scriptProcessor = inCtx.createScriptProcessor(512, 1, 1);
            scriptProcessorRef.current = scriptProcessor;

            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              
              // Visualizer feedback
              let sum = 0;
              for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
              const rms = Math.sqrt(sum / inputData.length);
              setInputIntensity(rms > 0.005 ? rms * 12 : 0); 

              const pcmBlob = createBlob(inputData);
              sessionPromise.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };

            source.connect(scriptProcessor);
            scriptProcessor.connect(inCtx.destination);
            
            // Proactive trigger to make the ghost speak first
            sessionPromise.then(s => {
              s.sendRealtimeInput({ 
                media: { data: 'AAAA', mimeType: 'audio/pcm;rate=16000' } 
              });
            });
          },
          onmessage: async (message: LiveServerMessage) => {
            // Instant interruption handling
            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setModelIntensity(0);
              return;
            }

            const turnParts = message.serverContent?.modelTurn?.parts || [];
            for (const part of turnParts) {
              if (part.inlineData?.data) {
                const audioBuffer = await decodeAudioData(decode(part.inlineData.data), outCtx, 24000, 1);
                const source = outCtx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(outCtx.destination);
                
                const startAt = Math.max(nextStartTimeRef.current, outCtx.currentTime);
                source.start(startAt);
                nextStartTimeRef.current = startAt + audioBuffer.duration;
                
                sourcesRef.current.add(source);
                setModelIntensity(1.0);
                
                source.onended = () => {
                  sourcesRef.current.delete(source);
                  if (sourcesRef.current.size === 0) setModelIntensity(0);
                };
              }
              if (part.text) {
                currentModelTextRef.current += part.text;
              }
            }

            if (message.serverContent?.inputTranscription) {
              currentUserTextRef.current += message.serverContent.inputTranscription.text;
            }

            if (message.serverContent?.turnComplete) {
              if (currentUserTextRef.current || currentModelTextRef.current) {
                const newItems: TranscriptionItem[] = [
                  { role: 'user', text: currentUserTextRef.current || '...', id: Math.random().toString() },
                  { role: 'model', text: currentModelTextRef.current || '...', id: Math.random().toString() }
                ];
                setHistory(prev => [...prev, ...newItems].slice(-1));
                currentUserTextRef.current = '';
                currentModelTextRef.current = '';
              }
            }
          },
          onerror: (e: any) => {
            console.error('Session Error:', e);
            if (e?.message?.includes('permission')) {
               setErrorMessage("The Ghost is barred by a celestial firewall (API Permission Error). Check your project's Live API status.");
            } else {
               setErrorMessage("The link has fractured. Wolfa is lost in the void.");
            }
            cleanup();
          },
          onclose: () => cleanup()
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } }
          },
          systemInstruction: SYSTEM_INSTRUCTION,
          inputAudioTranscription: {},
          outputAudioTranscription: {}
        }
      });

      sessionRef.current = await sessionPromise;
    } catch (err: any) {
      console.error('Start error:', err);
      setErrorMessage(err?.message || "Ritual failure. Microphone unreachable.");
      cleanup();
    }
  };

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-6 text-red-700 select-none overflow-hidden relative transition-all duration-1000 ${status === ConnectionStatus.CONNECTED ? 'bg-black' : 'bg-[#020000]'}`}>
      <BloodDrips />
      
      <div className="absolute inset-0 opacity-[0.05] bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] pointer-events-none" />
      
      <header className="fixed top-12 text-center z-20 pointer-events-none">
        <h1 className="text-7xl md:text-[11rem] tracking-tighter blood-glow animate-flicker" style={{ fontFamily: "'Nosifer', cursive" }}>
          WOLFA
        </h1>
        <div className="flex items-center justify-center gap-4 mt-2 font-black uppercase tracking-[1.2em] text-[8px] opacity-40">
          <div className={`w-1 h-1 rounded-full ${status === ConnectionStatus.CONNECTED ? 'bg-red-600 shadow-[0_0_15px_red] animate-ping' : 'bg-zinc-800'}`} />
          {status === ConnectionStatus.CONNECTED ? 'GHOST DETECTED' : 'THE VEIL IS UNBROKEN'}
        </div>
      </header>

      <main className="flex flex-col items-center gap-16 w-full max-w-2xl z-10 mt-24">
        <Visualizer 
            isActive={status === ConnectionStatus.CONNECTED} 
            modelIntensity={modelIntensity} 
            inputIntensity={inputIntensity} 
        />

        <div className="flex flex-col items-center gap-10 w-full -mt-16">
          {status === ConnectionStatus.IDLE && (
            <button
              onClick={handleStart}
              className="group relative px-24 py-10 border-4 border-red-950 hover:border-red-600 transition-all duration-700 bg-black shadow-[0_0_60px_rgba(139,0,0,0.3)]"
            >
              <div className="absolute inset-0 bg-red-950/20 -translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
              <span className="relative text-4xl tracking-[0.4em] text-red-900 group-hover:text-red-500 font-bold" style={{ fontFamily: "'Creepster', cursive" }}>
                SUMMON
              </span>
            </button>
          )}

          {status === ConnectionStatus.CONNECTING && (
            <div className="text-3xl animate-pulse text-red-800 uppercase tracking-[0.8em] font-black italic blood-glow">
              TEARING...
            </div>
          )}

          {status === ConnectionStatus.CONNECTED && (
            <button
              onClick={cleanup}
              className="px-16 py-4 border border-red-950/50 text-red-950 hover:text-red-600 hover:border-red-700 transition-all text-[10px] uppercase tracking-[1.2em] font-black bg-black/20"
            >
              SEVER THE LINK
            </button>
          )}

          {errorMessage && (
            <div className="text-red-600 border-2 border-red-900 p-8 bg-black/95 font-mono text-[11px] max-w-md text-center tracking-tight leading-loose shadow-[0_0_100px_rgba(255,0,0,0.1)]">
              <span className="text-red-900 block mb-2 font-black">[ACCESS_DENIED_VOID]</span>
              {errorMessage}
            </div>
          )}
        </div>

        {history.length > 0 && status === ConnectionStatus.CONNECTED && (
          <div className="w-full h-24 overflow-hidden flex flex-col justify-center items-center opacity-40 pointer-events-none">
            {history.map((item) => (
              <p key={item.id} className={`text-[11px] uppercase tracking-[0.3em] font-bold text-center leading-relaxed ${item.role === 'model' ? 'text-red-500' : 'text-zinc-500'}`}>
                {item.text}
              </p>
            ))}
          </div>
        )}
      </main>

      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 shadow-[inset_0_0_400px_rgba(0,0,0,1)]" />
        {status === ConnectionStatus.CONNECTED && (
          <div className="w-full h-[2px] bg-red-900/10 absolute top-0 animate-[scanline_6s_linear_infinite]" />
        )}
      </div>

      <footer className="fixed bottom-8 text-[9px] opacity-10 tracking-[3em] text-center uppercase pointer-events-none font-black text-red-950">
        HAVE YOU SEEN MY BODY?
      </footer>

      <style>{`
        @keyframes scanline {
          from { top: -10%; }
          to { top: 110%; }
        }
      `}</style>
    </div>
  );
}

export default App;
