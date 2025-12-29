
import React, { useMemo } from 'react';

interface VisualizerProps {
  isActive: boolean;
  modelIntensity: number;
  inputIntensity: number;
}

export const Visualizer: React.FC<VisualizerProps> = ({ isActive, modelIntensity, inputIntensity }) => {
  const eyeScale = useMemo(() => 1 + (modelIntensity * 0.5) + (inputIntensity * 0.4), [modelIntensity, inputIntensity]);
  const dilation = useMemo(() => 10 + (modelIntensity * 90) + (inputIntensity * 30), [modelIntensity, inputIntensity]);
  
  const irisColor = useMemo(() => {
    if (modelIntensity > 0.1) return '#ff0000'; // Ghost is speaking (Vibrant Blood Red)
    if (inputIntensity > 0.05) return '#8b0000'; // Listening (Dark Blood)
    return '#1a0000'; // Dormant
  }, [modelIntensity, inputIntensity]);
  
  return (
    <div className="relative flex items-center justify-center w-[450px] h-[450px]">
      {/* Necrotic Glow */}
      <div 
        className="absolute inset-0 rounded-full blur-[150px] transition-all duration-300 ease-out"
        style={{ 
          backgroundColor: irisColor,
          transform: `scale(${eyeScale * 1.6})`,
          opacity: isActive ? 0.2 + (modelIntensity * 0.7) : 0
        }}
      />
      
      {/* The Sclera (The White of the Eye - turned black and veined) */}
      <div 
        className={`relative w-72 h-72 rounded-full border-4 border-red-950 bg-black overflow-hidden shadow-[inset_0_0_120px_rgba(0,0,0,1)] transition-transform duration-100 ${isActive ? 'animate-[twitch_8s_infinite]' : ''}`}
        style={{ 
          transform: `scale(${eyeScale})`,
          boxShadow: isActive ? `0 0 80px ${irisColor}44` : 'none'
        }}
      >
        {/* Blood Veins Pattern */}
        <div className="absolute inset-0 opacity-40 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] rotate-45 scale-150" />
        
        {/* The Iris/Pupil Rift */}
        <div 
          className="absolute inset-0 m-auto rounded-full blur-[2px] transition-all duration-100 ease-out"
          style={{ 
            backgroundColor: irisColor,
            height: `${dilation + 15}px`,
            width: `${12 + (modelIntensity * 40) + (inputIntensity * 20)}px`,
            boxShadow: `0 0 100px ${irisColor}, inset 0 0 20px black`,
            opacity: isActive ? 1 : 0.1,
            transform: `rotate(${inputIntensity * 20}deg)`
          }}
        />

        {/* Cataract/Fog Layer */}
        <div className="absolute inset-0 opacity-10 pointer-events-none bg-gradient-to-tr from-transparent via-red-900/20 to-transparent" />
      </div>

      <style>{`
        @keyframes twitch {
          0%, 100% { transform: translate(0,0) scale(1); }
          5% { transform: translate(-5px, 2px) rotate(1deg); }
          10% { transform: translate(3px, -4px) rotate(-1deg); }
          15% { transform: translate(-2px, 3px) scale(1.05); }
          20% { transform: translate(0, 0); }
        }
      `}</style>
    </div>
  );
};
