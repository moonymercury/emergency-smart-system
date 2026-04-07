import React, { useState, useEffect } from 'react';
import { Map, Navigation2, HandHelping, Bell, AlertTriangle, MessageCircle, ArrowUpCircle, PhoneCall, Volume2, VolumeX, CheckCircle2, Activity, LocateFixed, FileText, Droplets, Bone, Loader2, Share2, Users, MapPin } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('progress'); 
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);
  const [isLineBound, setIsLineBound] = useState(false);

  // === 視角模式 ===
  const [isFamilyMode, setIsFamilyMode] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  // === 核心進度狀態 ===
  const [currentStep, setCurrentStep] = useState(1); 
  const [waitingCount, setWaitingCount] = useState(12);
  const [estimatedTime, setEstimatedTime] = useState(45);
  const [currentStatus, setCurrentStatus] = useState('X光與抽血檢查中');
  
  // === 警報與逆向呼叫狀態 ===
  const [showUrgentCall, setShowUrgentCall] = useState(false);
  const [recallInfo, setRecallInfo] = useState(null); 

  // === 檢驗報告狀態 ===
  const [labStatus, setLabStatus] = useState({
    blood: { status: 'processing', text: '血液檢驗中', eta: '約 30 分鐘' },
    xray: { status: 'pending', text: '尚未拍攝 X 光', eta: '-' },
    urine: { status: 'done', text: '尿液檢驗完成', eta: '已出爐' }
  });

  // === 導航狀態 ===
  const [activeDestination, setActiveDestination] = useState(null);
  const [navigationState, setNavigationState] = useState('idle'); 
  const [currentFloor, setCurrentFloor] = useState('1F');

  // ================= 核心：語音與音效引擎 =================
  const playVoice = (text) => {
    if ('speechSynthesis' in window && isAudioUnlocked) {
      window.speechSynthesis.cancel(); 
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-TW';
      utterance.rate = 0.9; 
      utterance.pitch = 1.1;
      window.speechSynthesis.speak(utterance);
    }
  };

  const unlockAudio = () => {
    setIsAudioUnlocked(true);
    if ('speechSynthesis' in window) {
      const unlockMsg = new SpeechSynthesisUtterance('系統語音已成功開啟。');
      unlockMsg.lang = 'zh-TW';
      unlockMsg.rate = 0.9;
      window.speechSynthesis.speak(unlockMsg);
    }
  };

  const triggerVibrationAndSound = () => {
    if (navigator.vibrate) navigator.vibrate([1000, 500, 1000, 500, 1000]);
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 1.5);
    } catch (e) { console.log('Audio API not supported'); }
  };

  const triggerUrgentCall = () => {
    setWaitingCount(0);
    setShowUrgentCall(true);
    triggerVibrationAndSound();
    playVoice('王阿公！輪到您了！請馬上到急診一診。');
  };

  const triggerRecall = (type) => {
    if (navigator.vibrate) navigator.vibrate([800, 400, 800]);
    if (type === 'nurse') {
      setRecallInfo({ type: 'nurse', title: '護理站 正在找您', desc: '請您盡快返回護理站櫃檯。', color: 'bg-indigo-900/95', icon: '👩‍⚕️', borderColor: 'border-indigo-400' });
      playVoice('王阿公您好，護理站正在找您，請看手機畫面跟著導航回來。');
    } else if (type === 'xray') {
      setRecallInfo({ type: 'xray', title: 'X光室 正在呼叫您', desc: '檢查室已準備好，請盡快前往。', color: 'bg-cyan-900/95', icon: '☢️', borderColor: 'border-cyan-400' });
      playVoice('王阿公您好，X光室正在呼叫您，請看手機畫面跟著導航前往。');
    }
  };

  const acceptRecallAndNavigate = () => {
    const dest = recallInfo.type;
    setRecallInfo(null);
    setActiveTab('nav');
    handleNavigation(dest);
  };

  const handleShareToFamily = () => {
    setShowShareModal(true);
    playVoice('已產生專屬連結，請選擇要傳送的 LINE 親友。');
    setTimeout(() => { setShowShareModal(false); }, 3000);
  };

  const toggleFamilyMode = () => {
    setIsFamilyMode(!isFamilyMode);
    setActiveTab('progress');
    setNavigationState('idle');
    setActiveDestination(null);
    playVoice(!isFamilyMode ? '切換為家屬探視視角。' : '切換回病患本人視角。');
  };

  const triggerRFIDUpdate = () => {
    setCurrentStep(2);
    setCurrentStatus('等待檢驗報告');
    setWaitingCount(2);
    setEstimatedTime(15);
    setLabStatus({
      blood: { status: 'done', text: '血液檢驗完成', eta: '已出爐' },
      xray: { status: 'done', text: 'X 光影像完成', eta: '已上傳' },
      urine: { status: 'done', text: '尿液檢驗完成', eta: '已出爐' }
    });
    if (isAudioUnlocked) playVoice('X光檢查已完成。目前正在為您等待所有檢驗報告。');
  };

  // ================= 導航邏輯與地圖 =================
  const handleNavigation = (destId) => {
    setActiveDestination(destId);
    setCurrentFloor('1F');
    setNavigationState('navigating_1f');

    if (destId === 'xray') playVoice('正在為您導航至 X光室。請依循藍色路線直走。');
    else if (destId === 'icu') playVoice('正在為您導航至 3樓 加護病房。請先依循藍線前往電梯。');
    else if (destId === 'nurse') playVoice('正在帶您返回護理站。請依循藍色路線直走。');
    else if (destId === 'find_patient') playVoice('正在帶您尋找王阿公，請直走到底。');
  };

  const handleEnterElevator = () => {
    setNavigationState('in_elevator');
    playVoice('請搭乘電梯至 3 樓。');
  };

  const handleArriveAt3F = () => {
    setCurrentFloor('3F');
    setNavigationState('navigating_3f');
    playVoice('已抵達 3 樓。請直走到底，加護病房在您的左手邊。');
  };

  const mapGrid = Array(7).fill(null).map(() => Array(7).fill(0));
  const getCellClass = (row, col) => {
    if (row === 3 && col < 5) return 'bg-[#111e33] border-t-4 border-[#070f1e] shadow-[0_4px_0_#000]'; 
    if (row === 1 && col === 6) return 'bg-amber-500 shadow-[0_0_15px_#f59e0b] z-20'; // 電梯
    
    let baseClass = 'bg-[#1e293b] border-[#0f172a] border';
    const startRow = isFamilyMode ? 6 : 5;
    const startCol = isFamilyMode ? 3 : 1;

    if (navigationState === 'idle' && row === startRow && col === startCol) return 'bg-emerald-400 animate-pulse z-20 shadow-[0_0_15px_#34d399]'; 
    
    // 家屬找病人
    if (navigationState === 'navigating_1f' && activeDestination === 'find_patient') {
      if (row === startRow && col === startCol) return 'bg-emerald-400 z-20 shadow-[0_0_15px_#34d399]'; 
      if (row === 1 && col === 4) return 'bg-rose-400 animate-bounce z-20 shadow-[0_0_15px_#fb7185]'; 
      if ((col === 3 && row <= 6 && row >= 1) || (row === 1 && col >= 3 && col <= 4)) return 'bg-sky-400 opacity-80 z-10 shadow-[0_0_10px_#38bdf8]';
    }

    // 護理站逆向導航
    if (navigationState === 'navigating_1f' && activeDestination === 'nurse' && !isFamilyMode) {
      if (row === startRow && col === startCol) return 'bg-emerald-400 z-20 shadow-[0_0_15px_#34d399]';
      if (row === 2 && col === 1) return 'bg-indigo-400 animate-bounce z-20 shadow-[0_0_15px_#818cf8]'; 
      if (row >= 2 && row <= 5 && col === 1) return 'bg-sky-400 opacity-80 z-10 shadow-[0_0_10px_#38bdf8]'; 
    }

    // X光室導航
    if (navigationState === 'navigating_1f' && activeDestination === 'xray' && !isFamilyMode) {
      if (row === startRow && col === startCol) return 'bg-emerald-400 z-20 shadow-[0_0_15px_#34d399]';
      if (row === 1 && col === 4) return 'bg-rose-400 animate-bounce z-20 shadow-[0_0_15px_#fb7185]'; 
      if ((row === 5 && col > 1 && col <= 4) || (col === 4 && row < 5 && row >= 1)) return 'bg-sky-400 opacity-80 z-10 shadow-[0_0_10px_#38bdf8]'; 
    }

    // 加護病房 (跨樓層)
    if (navigationState === 'navigating_1f' && activeDestination === 'icu') {
      if (row === startRow && col === startCol) return 'bg-emerald-400 z-20 shadow-[0_0_15px_#34d399]';
      if (row === 1 && col === 6) return 'bg-amber-500 animate-bounce z-20 shadow-[0_0_15px_#f59e0b]'; 
      if (!isFamilyMode && ((row === 5 && col > 1 && col <= 6) || (col === 6 && row < 5 && row >= 1))) return 'bg-sky-400 opacity-80 z-10 shadow-[0_0_10px_#38bdf8]';
      if (isFamilyMode && ((col === 3 && row <= 6 && row >= 1) || (row === 1 && col >= 3 && col <= 6))) return 'bg-sky-400 opacity-80 z-10 shadow-[0_0_10px_#38bdf8]';
    }
    if (navigationState === 'navigating_3f' && activeDestination === 'icu') {
      if (row === 1 && col === 6) return 'bg-amber-500 z-20 shadow-[0_0_15px_#f59e0b]'; 
      if (row === 5 && col === 2) return 'bg-rose-400 animate-bounce z-20 shadow-[0_0_15px_#fb7185]'; 
      if ((col === 6 && row > 1 && row <= 5) || (row === 5 && col < 6 && col >= 2)) return 'bg-sky-400 opacity-80 z-10 shadow-[0_0_10px_#38bdf8]';
    }

    return baseClass;
  };

  const steps = ['掛號', '檢查', '報告', '診察', '離院'];

  return (
    <div className="min-h-screen flex justify-center items-start sm:p-4 font-sans text-[#e2e8f0] relative overflow-hidden bg-[#070f1e]">
      
      {/* 背景特效 */}
      <div className="absolute inset-0 pointer-events-none z-0" style={{ background: 'radial-gradient(ellipse 80% 40% at 20% 10%, rgba(56,189,248,0.07) 0%, transparent 60%), radial-gradient(ellipse 60% 30% at 80% 80%, rgba(52,211,153,0.05) 0%, transparent 60%)' }}></div>

      {/* 手機外框: 使用標準 Flex 佈局防止遮擋 */}
      <div className="w-full max-w-md bg-[#070f1e] sm:rounded-[2.5rem] shadow-2xl sm:border-[6px] border-[#111e33] flex flex-col h-[100dvh] sm:h-[850px] relative z-10">
        
        {/* ================= 強制語音解鎖畫面 ================= */}
        {!isAudioUnlocked && (
          <div className="absolute inset-0 bg-[#070f1e]/98 z-[100] flex flex-col items-center justify-center p-8 backdrop-blur-xl">
            <div className="w-32 h-32 rounded-full bg-[#111e33] border-4 border-emerald-500/50 flex items-center justify-center mb-8 animate-pulse shadow-[0_0_30px_rgba(52,211,153,0.2)]">
              <Volume2 className="w-16 h-16 text-emerald-400" />
            </div>
            <h2 className="text-4xl font-black text-white mb-4 text-center tracking-widest">歡迎使用<br/><span className="text-[#38bdf8] mt-2 block">急診智能服務</span></h2>
            <p className="text-sky-200/80 text-xl text-center mb-12 leading-relaxed">本系統提供即時叫號與語音導航。請點擊下方按鈕啟動服務。</p>
            <button onClick={unlockAudio} className="bg-emerald-500 text-[#070f1e] font-black text-3xl py-6 px-4 w-full rounded-3xl shadow-[0_0_40px_rgba(52,211,153,0.4)] hover:scale-105 transition-transform">
              點此進入系統<br/><span className="text-lg opacity-80">(並開啟語音)</span>
            </button>
          </div>
        )}

        {/* ================= 頭部 (Header) - flex-shrink-0 保證不被壓縮 ================= */}
        <div className={`bg-[#0d1b2e]/90 backdrop-blur-lg border-b px-5 py-3 shrink-0 flex flex-col gap-2 z-30 transition-colors ${isFamilyMode ? 'border-amber-500/50' : 'border-[#38bdf8]/20'}`}>
          <div className="flex items-center justify-between">
            <div className="text-[#38bdf8] text-sm tracking-widest font-mono font-bold">某某醫學中心</div>
            {isFamilyMode ? (
               <div className="flex items-center gap-1.5 bg-amber-500/20 border border-amber-500/50 px-3 py-1 rounded-full">
                 <Users className="w-4 h-4 text-amber-400" /><span className="text-amber-400 text-xs font-bold">家屬跟隨模式</span>
               </div>
            ) : (
              isLineBound ? (
                <div className="flex items-center gap-1.5 bg-[#06C755]/10 border border-[#06C755]/30 px-3 py-1 rounded-full">
                  <MessageCircle className="w-4 h-4 text-[#06C755]" /><span className="text-[#06C755] text-xs font-bold">LINE 已連線</span>
                </div>
              ) : (
                <button onClick={() => setIsLineBound(true)} className="bg-[#06C755] text-white text-xs font-bold py-1.5 px-3 rounded-full flex items-center gap-1">
                  <MessageCircle className="w-3 h-3" /> 一鍵綁定 LINE
                </button>
              )
            )}
          </div>
          
          <div className="flex justify-between items-center mt-1">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-black text-white tracking-wide">王阿公</h1>
              <div className="flex items-center gap-1.5 bg-emerald-400/10 border border-emerald-400/30 px-2 py-1 rounded-full">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_#34d399]"></div>
                <span className="text-emerald-400 text-xs font-bold tracking-wider">即時定位</span>
              </div>
            </div>
            {isFamilyMode ? (
              <button onClick={() => {setActiveTab('nav'); handleNavigation('find_patient');}} className="p-2 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 animate-pulse">
                <LocateFixed className="w-6 h-6" />
              </button>
            ) : (
              <div className="bg-[#3b4252] p-2 rounded-2xl border border-[#4c566a]">
                <Volume2 className="w-6 h-6 text-emerald-400" />
              </div>
            )}
          </div>
        </div>

        {/* ================= 內容區域 (Main Content) - flex-grow overflow-y-auto ================= */}
        {/* 這個區塊會自適應填滿剩餘空間，並允許上下滾動，保證不被底部導覽列覆蓋 */}
        <div className="flex-1 overflow-y-auto bg-transparent scroll-smooth pb-6">
          
          {/* TAB 1: 看進度 */}
          {activeTab === 'progress' && (
            <div className="p-4 space-y-4 animate-[fadeIn_0.3s_ease-out]">
              
              {/* 主視覺狀態卡片 */}
              <div className={`rounded-[2rem] p-6 shadow-2xl relative overflow-hidden border ${isFamilyMode ? 'bg-gradient-to-b from-[#451a03] to-[#0f172a] border-amber-500/30' : 'bg-gradient-to-b from-[#1e3a8a] to-[#0f172a] border-blue-500/30'}`}>
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>
                <div className="flex items-center gap-2 mb-4">
                  <div className={`w-3 h-3 rounded-full animate-pulse ${isFamilyMode ? 'bg-amber-400 shadow-[0_0_10px_#fbbf24]' : 'bg-emerald-400 shadow-[0_0_10px_#34d399]'}`}></div>
                  <span className="text-blue-100 font-bold text-lg">{isFamilyMode ? '阿公現在正在：' : '目前狀態：'}{currentStatus}</span>
                </div>
                <div className="text-center mb-6">
                  <div className="text-gray-300 font-bold text-xl mb-1">{isFamilyMode ? '就診號碼' : '您的號碼'}</div>
                  <div className="text-[64px] sm:text-[72px] font-black text-white leading-none tracking-wider drop-shadow-lg">A047</div>
                </div>
                <div className="bg-black/30 rounded-2xl p-4 flex justify-between items-center border border-white/5">
                  <div className="text-center flex-1 border-r border-white/10">
                    <div className="text-blue-200/70 text-sm font-bold">前面人數</div>
                    <div className="text-3xl sm:text-4xl font-black text-amber-400 mt-1">{waitingCount}</div>
                  </div>
                  <div className="text-center flex-1">
                    <div className="text-blue-200/70 text-sm font-bold">預估等候</div>
                    <div className="text-3xl sm:text-4xl font-black text-white mt-1">{estimatedTime}<span className="text-xl ml-1">分</span></div>
                  </div>
                </div>
              </div>

              {/* 橫向「就診流程」進度條 */}
              <div className="bg-[#111e33] border border-[#38bdf8]/20 rounded-[2rem] p-5 shadow-lg">
                <h3 className="text-sm text-sky-400/80 font-mono tracking-widest uppercase mb-6 flex items-center gap-2"><Activity className="w-4 h-4"/> 就診流程</h3>
                <div className="flex justify-between items-center relative px-2">
                  <div className="absolute left-4 right-4 top-1/2 -translate-y-1/2 h-1 bg-gray-700 z-0"></div>
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 h-1 bg-[#38bdf8] z-0 transition-all duration-500" style={{ width: `calc(${(currentStep / (steps.length - 1)) * 100}% - 2rem)` }}></div>
                  {steps.map((step, index) => {
                    const isCompleted = index < currentStep;
                    const isActive = index === currentStep;
                    return (
                      <div key={index} className="relative z-10 flex flex-col items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${isCompleted ? 'bg-[#38bdf8] text-[#070f1e] shadow-[0_0_10px_#38bdf8]' : isActive ? 'bg-[#070f1e] border-[3px] border-[#38bdf8] text-[#38bdf8] shadow-[0_0_15px_#38bdf8] animate-pulse' : 'bg-[#111e33] text-gray-500 border border-gray-600'}`}>
                          {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : (index + 1)}
                        </div>
                        <span className={`text-[11px] sm:text-xs font-bold ${isActive ? 'text-[#38bdf8]' : isCompleted ? 'text-white' : 'text-gray-500'}`}>{step}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 檢驗報告進度 */}
              {currentStep >= 1 && currentStep <= 2 && (
                <div className="bg-[#111e33] border border-[#38bdf8]/20 rounded-[2rem] p-5 shadow-lg animate-[fadeIn_0.5s_ease-out]">
                  <h3 className="text-sm text-sky-400/80 font-mono tracking-widest uppercase mb-4 flex items-center gap-2"><FileText className="w-4 h-4"/> 檢驗與報告進度</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/5">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${labStatus.blood.status === 'done' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}><Droplets className="w-5 h-5" /></div>
                        <div><div className="font-bold text-base sm:text-lg">血液常規</div><div className="text-gray-400 text-xs sm:text-sm">{labStatus.blood.text}</div></div>
                      </div>
                      <div className={`font-bold text-sm sm:text-base ${labStatus.blood.status === 'done' ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {labStatus.blood.status === 'processing' ? <Loader2 className="w-5 h-5 animate-spin" /> : '完成'}
                      </div>
                    </div>
                    <div className="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/5">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${labStatus.xray.status === 'done' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-700 text-gray-400'}`}><Bone className="w-5 h-5" /></div>
                        <div><div className="font-bold text-base sm:text-lg">X 光攝影</div><div className="text-gray-400 text-xs sm:text-sm">{labStatus.xray.text}</div></div>
                      </div>
                      <div className={`font-bold text-sm sm:text-base ${labStatus.xray.status === 'done' ? 'text-emerald-400' : 'text-gray-500'}`}>
                        {labStatus.xray.status === 'done' ? '完成' : '待檢驗'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 分享與測試區塊 */}
              <div className="pt-2 space-y-3">
                {!isFamilyMode && (
                  <button onClick={handleShareToFamily} className="w-full bg-[#06C755]/10 border border-[#06C755]/50 text-[#06C755] hover:bg-[#06C755] hover:text-white text-lg font-bold py-3 rounded-2xl transition-colors flex justify-center items-center gap-2">
                    <Share2 className="w-5 h-5" /> 分享位置與進度給家人
                  </button>
                )}

                {!isFamilyMode && (
                  <div className="bg-[#111e33] border border-indigo-500/30 rounded-2xl p-4 space-y-3">
                    <div className="text-xs text-indigo-300 font-mono text-center">👇 逆向尋人導航測試 👇</div>
                    <div className="flex gap-2">
                      <button onClick={() => triggerRecall('nurse')} className="flex-1 bg-indigo-600/20 border border-indigo-500 text-indigo-400 py-2 rounded-xl font-bold text-xs sm:text-sm">👩‍⚕️ 護理站找人</button>
                      <button onClick={() => triggerRecall('xray')} className="flex-1 bg-cyan-600/20 border border-cyan-500 text-cyan-400 py-2 rounded-xl font-bold text-xs sm:text-sm">☢️ X光室呼叫</button>
                    </div>
                  </div>
                )}

                {!isFamilyMode && (
                  <div className="flex gap-2">
                    <button onClick={triggerRFIDUpdate} disabled={currentStep >= 2} className="flex-1 bg-sky-600/20 border border-sky-500 text-sky-400 font-bold py-3 rounded-xl text-xs sm:text-sm active:bg-sky-600 active:text-white">[模擬] RFID 進度</button>
                    <button onClick={triggerUrgentCall} className="flex-1 bg-rose-500/20 border border-rose-500 text-rose-400 font-bold py-3 rounded-xl text-xs sm:text-sm flex justify-center items-center gap-1 active:bg-rose-500 active:text-white"><AlertTriangle className="w-4 h-4"/> 強制叫號</button>
                  </div>
                )}

                <button onClick={toggleFamilyMode} className="w-full bg-gray-800 text-gray-400 text-xs font-bold py-3 rounded-xl mt-4">
                  [展示用] 切換為：{isFamilyMode ? '病患本人視角' : '晚到家屬視角'}
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: 找路導航 */}
          {activeTab === 'nav' && (
            <div className="flex flex-col animate-[fadeIn_0.3s_ease-out]">
              {/* 地圖顯示區：採用 padding 撐開，確保內部 3D 變形不被裁切 */}
              <div className="bg-[#0d1b2e] py-12 flex flex-col items-center justify-center overflow-hidden relative shadow-inner border-b border-[#111e33] min-h-[320px]">
                
                <div className="absolute top-4 left-4 z-30 flex gap-2 flex-col">
                  {isFamilyMode && <div className="bg-amber-500/90 text-[#070f1e] text-xs font-bold px-3 py-1 rounded-lg mb-1 shadow-lg">起點：急診大門口</div>}
                  <div className="flex gap-2">
                    <span className={`text-xs px-3 py-1.5 rounded-xl font-bold border ${currentFloor === '1F' ? 'bg-[#38bdf8]/20 border-[#38bdf8] text-[#38bdf8]' : 'bg-[#1e293b] border-transparent text-gray-400'}`}>1F 急診</span>
                    <span className={`text-xs px-3 py-1.5 rounded-xl font-bold border ${currentFloor === '3F' ? 'bg-[#38bdf8]/20 border-[#38bdf8] text-[#38bdf8]' : 'bg-[#1e293b] border-transparent text-gray-400'}`}>3F 病房</span>
                  </div>
                </div>

                {navigationState === 'in_elevator' && (
                  <div className="absolute inset-0 bg-[#070f1e]/95 z-40 flex flex-col items-center justify-center backdrop-blur-sm">
                    <ArrowUpCircle className="w-20 h-20 text-amber-400 mb-6 animate-bounce" />
                    <h2 className="text-2xl font-bold text-white mb-8">請搭乘至 3 樓</h2>
                    <button onClick={handleArriveAt3F} className="bg-emerald-500 text-white text-xl font-bold py-3 px-8 rounded-2xl shadow-[0_0_20px_rgba(52,211,153,0.3)] active:scale-95">我到了 (3F)</button>
                  </div>
                )}

                {/* 3D 網格：響應式大小調整 */}
                <div className="relative w-[224px] h-[224px] sm:w-[252px] sm:h-[252px]" style={{ transform: 'rotateX(55deg) rotateZ(-45deg)', transformStyle: 'preserve-3d' }}>
                  {mapGrid.map((row, rowIndex) => (
                    <div key={rowIndex} className="flex">
                      {row.map((_, colIndex) => (
                        <div key={`${rowIndex}-${colIndex}`} className={`w-8 h-8 sm:w-9 sm:h-9 m-[1px] rounded-sm relative transition-all duration-500 ${getCellClass(rowIndex, colIndex)}`} style={{ transformStyle: 'preserve-3d' }}>
                           {/* 確保 Emoji 直立顯示，並修正座標對位 */}
                           {rowIndex === 1 && colIndex === 4 && (activeDestination === 'xray' || activeDestination === 'find_patient') && currentFloor === '1F' && 
                              <div className="absolute -top-10 -left-3 transform rotateX(-55deg) rotateZ(45deg) text-4xl sm:text-5xl z-30">{isFamilyMode ? '👴' : '☢️'}</div>}
                           {rowIndex === 2 && colIndex === 1 && activeDestination === 'nurse' && currentFloor === '1F' && 
                              <div className="absolute -top-10 -left-3 transform rotateX(-55deg) rotateZ(45deg) text-4xl sm:text-5xl z-30">👩‍⚕️</div>}
                           {rowIndex === 1 && colIndex === 6 && 
                              <div className="absolute -top-8 -left-2 transform rotateX(-55deg) rotateZ(45deg) text-3xl sm:text-4xl opacity-80">🛗</div>}
                           {rowIndex === 5 && colIndex === 2 && activeDestination === 'icu' && currentFloor === '3F' && 
                              <div className="absolute -top-10 -left-3 transform rotateX(-55deg) rotateZ(45deg) text-4xl sm:text-5xl z-30">🏥</div>}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                {navigationState === 'navigating_1f' && activeDestination === 'icu' && (
                  <div className="absolute bottom-4 left-4 right-4 z-30">
                     <button onClick={handleEnterElevator} className="w-full bg-amber-500 text-[#070f1e] font-black py-3 text-lg rounded-2xl shadow-[0_0_20px_rgba(245,158,11,0.4)] animate-pulse flex justify-center items-center gap-2">
                       <ArrowUpCircle className="w-5 h-5" /> 點此搭乘電梯
                     </button>
                  </div>
                )}
              </div>

              {/* 目的地按鈕區塊 */}
              <div className="p-4 sm:p-6 bg-[#070f1e] z-10 pt-6">
                <div className="text-xs sm:text-sm text-sky-400/80 font-mono tracking-widest uppercase flex items-center gap-3 mb-5">
                  <span>{isFamilyMode ? '快速前往尋找病患' : '您要去哪裡？'}</span><div className="flex-1 h-[1px] bg-[#38bdf8]/20"></div>
                </div>
                
                {isFamilyMode ? (
                  <button onClick={() => handleNavigation('find_patient')} className={`w-full p-5 sm:p-6 rounded-[2rem] flex flex-col items-center justify-center gap-3 transition-all bg-gradient-to-br from-amber-500/20 to-[#111e33] border-2 border-amber-500 text-white shadow-[0_0_20px_rgba(245,158,11,0.2)]`}>
                    <span className="text-5xl sm:text-6xl drop-shadow-lg">👴</span><span className="text-2xl sm:text-3xl font-bold">帶我去找 王阿公</span>
                  </button>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <button onClick={() => handleNavigation('xray')} className={`p-4 sm:p-6 rounded-[1.5rem] flex flex-col items-center justify-center gap-2 transition-all ${activeDestination === 'xray' ? 'bg-gradient-to-br from-[#38bdf8]/20 to-[#111e33] border-2 border-[#38bdf8] text-white' : 'bg-[#111e33] border-2 border-transparent text-gray-300'}`}>
                      <span className="text-4xl sm:text-5xl drop-shadow-lg">☢️</span><span className="text-xl sm:text-2xl font-bold">X光室</span>
                    </button>
                    <button onClick={() => handleNavigation('icu')} className={`p-4 sm:p-6 rounded-[1.5rem] flex flex-col items-center justify-center gap-2 transition-all ${activeDestination === 'icu' ? 'bg-gradient-to-br from-[#f87171]/20 to-[#111e33] border-2 border-[#f87171] text-white' : 'bg-[#111e33] border-2 border-transparent text-gray-300'}`}>
                      <span className="text-4xl sm:text-5xl drop-shadow-lg">🏥</span><span className="text-xl sm:text-2xl font-bold">加護病房</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: 需要幫忙 */}
          {activeTab === 'help' && (
            <div className="p-4 space-y-6 animate-[fadeIn_0.3s_ease-out]">
              <div className="bg-rose-500/10 border-2 border-rose-500/50 rounded-3xl p-5 sm:p-6 relative overflow-hidden shadow-[0_0_20px_rgba(248,113,113,0.1)]">
                <div className="absolute inset-0 bg-rose-500/5 animate-pulse"></div>
                <div className="relative z-10 flex items-center gap-4 sm:gap-5">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 bg-rose-500/20 rounded-full flex items-center justify-center shrink-0 text-3xl sm:text-4xl">🚫</div>
                  <div>
                    <h3 className="text-rose-400 text-lg sm:text-xl font-bold mb-1 tracking-widest">護理站提醒</h3>
                    <p className="text-white text-2xl sm:text-[32px] font-black underline decoration-rose-500 decoration-4 underline-offset-4">現在禁止喝水</p>
                  </div>
                </div>
              </div>

              {!isFamilyMode && (
                <div className="pt-2">
                  <div className="text-xs sm:text-sm text-sky-400/80 font-mono tracking-widest uppercase flex items-center gap-3 mb-5">
                    <span>一鍵呼叫護理師</span><div className="flex-1 h-[1px] bg-[#38bdf8]/20"></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <button onClick={() => playVoice('已通知護理站您要去廁所。')} className="bg-[#111e33] border border-[#38bdf8]/20 text-white p-5 rounded-[1.5rem] flex flex-col items-center justify-center gap-3 active:scale-95 transition-transform">
                      <span className="text-4xl sm:text-5xl">🚽</span><span className="text-lg sm:text-xl font-bold">去廁所</span>
                    </button>
                    <button onClick={() => playVoice('已通知護理站更換點滴。')} className="bg-[#111e33] border border-[#38bdf8]/20 text-white p-5 rounded-[1.5rem] flex flex-col items-center justify-center gap-3 active:scale-95 transition-transform">
                      <span className="text-4xl sm:text-5xl">💧</span><span className="text-lg sm:text-xl font-bold">點滴沒了</span>
                    </button>
                    <button onClick={() => playVoice('已發送緊急求助。')} className="col-span-2 bg-gradient-to-r from-rose-600 to-red-500 text-white p-5 sm:p-6 rounded-[1.5rem] flex items-center justify-center gap-4 active:scale-95 transition-transform shadow-[0_0_20px_rgba(225,29,72,0.4)] mt-2">
                      <PhoneCall className="w-8 h-8 sm:w-10 sm:h-10 animate-pulse" />
                      <span className="text-2xl sm:text-3xl font-black tracking-wider">很不舒服</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ================= 底部導覽列 (Bottom Nav) - flex-shrink-0 保證永遠在底部 ================= */}
        <div className="bg-[#0d1b2e]/95 backdrop-blur-lg border-t border-[#38bdf8]/20 flex justify-around items-center py-2 pb-6 px-3 z-40 shrink-0">
          <button onClick={() => setActiveTab('progress')} className={`flex flex-col items-center justify-center w-[30%] py-3 rounded-2xl transition-all ${activeTab === 'progress' ? 'bg-[#38bdf8]/15 text-[#38bdf8] border border-[#38bdf8]/30 shadow-[0_0_15px_rgba(56,189,248,0.15)]' : 'text-gray-500 border border-transparent'}`}>
            <Activity className="w-6 h-6 sm:w-8 sm:h-8 mb-1" /><span className="text-base sm:text-lg font-bold">看進度</span>
          </button>
          <button onClick={() => setActiveTab('nav')} className={`flex flex-col items-center justify-center w-[30%] py-3 rounded-2xl transition-all ${activeTab === 'nav' ? 'bg-[#38bdf8]/15 text-[#38bdf8] border border-[#38bdf8]/30 shadow-[0_0_15px_rgba(56,189,248,0.15)]' : 'text-gray-500 border border-transparent'}`}>
            <MapPin className="w-6 h-6 sm:w-8 sm:h-8 mb-1" /><span className="text-base sm:text-lg font-bold">找路</span>
          </button>
          <button onClick={() => setActiveTab('help')} className={`flex flex-col items-center justify-center w-[30%] py-3 rounded-2xl transition-all ${activeTab === 'help' ? 'bg-[#38bdf8]/15 text-[#38bdf8] border border-[#38bdf8]/30 shadow-[0_0_15px_rgba(56,189,248,0.15)]' : 'text-gray-500 border border-transparent'}`}>
            <HandHelping className="w-6 h-6 sm:w-8 sm:h-8 mb-1" /><span className="text-base sm:text-lg font-bold">要幫忙</span>
          </button>
        </div>

        {/* ================= 浮動彈出視窗 (Modals) ================= */}
        
        {/* 逆向呼叫面板 */}
        {recallInfo && (
          <div className={`absolute inset-0 z-50 flex flex-col items-center justify-center p-6 ${recallInfo.color} backdrop-blur-xl animate-[fadeIn_0.2s_ease-out]`}>
            <div className="w-24 h-24 sm:w-32 sm:h-32 bg-white/20 rounded-full flex items-center justify-center text-5xl sm:text-7xl mb-6 animate-bounce shadow-2xl">
              {recallInfo.icon}
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-white mb-3 tracking-widest text-center drop-shadow-xl">{recallInfo.title}</h2>
            <p className="text-white/90 text-xl sm:text-2xl font-bold text-center mb-10 px-4 leading-relaxed">{recallInfo.desc}</p>
            <div className="w-full space-y-4 px-4">
              <button onClick={acceptRecallAndNavigate} className={`w-full bg-white text-gray-900 font-black text-2xl sm:text-3xl py-5 rounded-[1.5rem] shadow-[0_10px_30px_rgba(0,0,0,0.3)] active:scale-95 transition-transform flex items-center justify-center gap-2`}>
                <MapPin className="w-8 h-8" /> 帶我過去
              </button>
            </div>
          </div>
        )}

        {/* 分享給家屬 */}
        {showShareModal && (
          <div className="absolute inset-0 z-[60] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-[fadeIn_0.2s_ease-out]">
            <div className="bg-[#070f1e] border-2 border-[#06C755] rounded-3xl p-8 w-full text-center shadow-[0_0_30px_rgba(6,199,85,0.3)]">
              <div className="w-16 h-16 bg-[#06C755] rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce"><Share2 className="w-8 h-8 text-white" /></div>
              <h3 className="text-xl font-bold text-white mb-4">正在開啟 LINE</h3>
              <p className="text-gray-400 text-base mb-8">請選擇要傳送的群組或親友。</p>
              <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden"><div className="bg-[#06C755] h-full rounded-full animate-[progress_3s_linear]"></div></div>
            </div>
          </div>
        )}

        {/* 強制叫號警報 */}
        {showUrgentCall && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center p-6 bg-rose-600 backdrop-blur-xl animate-[flash_1s_infinite]">
            <AlertTriangle className="w-32 h-32 sm:w-48 sm:h-48 text-amber-300 mb-6 animate-bounce drop-shadow-[0_0_30px_rgba(245,158,11,0.5)]" />
            <h2 className="text-[56px] sm:text-[72px] font-black text-white mb-6 tracking-widest text-center drop-shadow-2xl">輪到您了</h2>
            <div className="bg-[#070f1e] p-8 sm:p-10 rounded-[2.5rem] w-full text-center shadow-2xl border-[4px] border-rose-400">
              <p className="text-rose-400 text-2xl sm:text-3xl font-bold mb-3">請立刻前往</p>
              <p className="text-white text-[48px] sm:text-[56px] font-black leading-none">急診一診</p>
            </div>
            <button onClick={() => { setShowUrgentCall(false); window.speechSynthesis?.cancel(); }} className="mt-12 bg-white text-rose-600 font-black text-2xl sm:text-3xl py-5 px-16 rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.3)] active:scale-95 transition-transform">
              我知道了
            </button>
          </div>
        )}

      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes flash { 0%, 100% { background-color: rgba(225, 29, 72, 1); } 50% { background-color: rgba(190, 18, 60, 1); } }
        @keyframes progress { from { width: 0%; } to { width: 100%; } }
      `}</style>
    </div>
  );
}
