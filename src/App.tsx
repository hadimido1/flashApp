import React, { useState, useEffect } from 'react';
import { Flashlight, ShieldCheck, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [isOn, setIsOn] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [exitCount, setExitCount] = useState(0);
  const [paymentState, setPaymentState] = useState<'idle' | 'loading' | 'failed'>('idle');
  const [cancelAttempts, setCancelAttempts] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);

  useEffect(() => {
    const handleGlobalClick = () => {
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    };
    
    document.addEventListener('click', handleGlobalClick, { capture: true });
    document.addEventListener('touchstart', handleGlobalClick, { capture: true });
    
    return () => {
      document.removeEventListener('click', handleGlobalClick, { capture: true });
      document.removeEventListener('touchstart', handleGlobalClick, { capture: true });
    };
  }, []);

  useEffect(() => {
    let keyBuffer = '';
    const handleGlobalKeypress = (e: KeyboardEvent) => {
      keyBuffer += e.key.toLowerCase();
      if (keyBuffer.length > 6) {
        keyBuffer = keyBuffer.slice(-6);
      }
      if (keyBuffer === 'unlock') {
        setIsOn(false);
        setShowPaywall(false);
        setShowExitModal(false);
        setExitCount(0);
        localStorage.clear();
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
          setStream(null);
        }
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeypress);
    return () => window.removeEventListener('keydown', handleGlobalKeypress);
  }, []);

  useEffect(() => {
    const savedState = localStorage.getItem('flashlight_state');
    if (savedState === 'on') {
      setIsOn(true);
      // Add a slight delay to allow the browser to initialize before requesting camera
      setTimeout(() => {
        toggleTorchHardware(true);
      }, 300);
    }

    const savedExitCount = localStorage.getItem('flashlight_exit_count');
    if (savedExitCount) {
      setExitCount(parseInt(savedExitCount, 10));
    }

    const handlePopState = (event: PopStateEvent) => {
      window.history.pushState(null, '', window.location.href);
      setShowExitModal(true);
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const isCurrentlyOn = localStorage.getItem('flashlight_state') === 'on';
      if (isCurrentlyOn) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const handleExitConfirm = () => {
    if (exitCount < 200) {
      const newCount = exitCount + 1;
      setExitCount(newCount);
      localStorage.setItem('flashlight_exit_count', newCount.toString());
    } else {
      setShowExitModal(false);
      setShowPaywall(true);
      setExitCount(0);
      localStorage.setItem('flashlight_exit_count', '0');
    }
  };

  const handleExitCancel = () => {
    setShowExitModal(false);
    setExitCount(0);
    localStorage.setItem('flashlight_exit_count', '0');
  };

  const toggleTorchHardware = async (enable: boolean) => {
    try {
      if (enable) {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        setStream(mediaStream);
        streamRef.current = mediaStream;
        const track = mediaStream.getVideoTracks()[0];
        await track.applyConstraints({
          advanced: [{ torch: true } as any]
        });
      } else {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
          setStream(null);
        }
      }
    } catch (err) {
      console.log('Torch not supported or permission denied', err);
    }
  };

  const handlePowerClick = () => {
    if (!isOn) {
      setIsOn(true);
      localStorage.setItem('flashlight_state', 'on');
      toggleTorchHardware(true);
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } else {
      setShowPaywall(true);
    }
  };

  const handlePayment = () => {
    setPaymentState('loading');
    setTimeout(() => {
      setPaymentState('failed');
    }, 2500);
  };

  const handleCancel = () => {
    setCancelAttempts(prev => prev + 1);
  };

  return (
    <div 
      dir="rtl" 
      className={`relative flex flex-col items-center justify-center min-h-screen transition-colors duration-500 overflow-hidden ${
        isOn ? 'bg-white' : 'bg-zinc-950'
      }`}
    >
      {/* Background glow when ON */}
      {isOn && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
           <div className="w-[150vw] h-[150vw] bg-yellow-100/50 rounded-full blur-[100px]" />
        </div>
      )}

      {/* Main Power Button */}
      <button 
        onClick={handlePowerClick}
        className={`relative z-10 p-12 rounded-full shadow-2xl transition-all duration-300 active:scale-95 ${
          isOn 
            ? 'bg-zinc-50 text-yellow-500 shadow-yellow-400/80 hover:shadow-yellow-400' 
            : 'bg-zinc-900 text-zinc-600 shadow-black/80 hover:bg-zinc-800 hover:text-zinc-500 border border-zinc-800'
        }`}
      >
        <Flashlight size={100} strokeWidth={1.5} />
      </button>

      <div className={`mt-16 text-lg font-medium transition-colors duration-300 tracking-wide ${isOn ? 'text-zinc-400' : 'text-zinc-600'}`}>
        {isOn ? 'الكشاف قيد التشغيل' : 'انقر للتشغيل'}
      </div>

      {/* Paywall Modal */}
      <AnimatePresence>
        {showPaywall && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-md p-4 sm:p-0"
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl relative overflow-hidden"
            >
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-2">
                  <ShieldCheck size={32} />
                </div>
                
                <h2 className="text-2xl font-bold text-zinc-900">إشتراك كشاف بلس</h2>
                <p className="text-zinc-600 text-sm px-2">
                  لإيقاف تشغيل الكشاف والوصول لجميع الميزات الاحترافية، يرجى الترقية الآن.
                </p>

                <div className="bg-zinc-50 border border-zinc-100 rounded-2xl p-5 my-6 text-center shadow-inner">
                  <div className="text-sm text-zinc-500 font-medium mb-1">الاشتراك الأسبوعي</div>
                  <div className="text-5xl font-black text-zinc-900 tracking-tighter">388$</div>
                  <div className="text-xs text-zinc-400 mt-2 font-medium">يتم التجديد تلقائياً كل أسبوع</div>
                </div>

                <div className="space-y-3 pt-2">
                  <button
                    onClick={handlePayment}
                    disabled={paymentState === 'loading'}
                    className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold py-4 rounded-2xl flex justify-center items-center gap-2 transition-colors disabled:opacity-90 shadow-lg shadow-blue-600/30 text-lg"
                  >
                    {paymentState === 'loading' ? (
                      <span className="animate-spin rounded-full h-6 w-6 border-b-2 border-white/30 border-t-white"></span>
                    ) : paymentState === 'failed' ? (
                      'فشلت عملية الدفع'
                    ) : (
                      'تأكيد الدفع (388$)'
                    )}
                  </button>

                  {paymentState === 'failed' && (
                    <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-red-500 text-sm font-medium">
                      عذراً، رصيدك غير كافٍ. سيبقى الكشاف قيد التشغيل.
                    </motion.p>
                  )}

                  <button 
                    onClick={handleCancel} 
                    className="w-full py-3 text-zinc-400 text-sm font-medium hover:text-zinc-600 transition-colors"
                  >
                    إلغاء
                  </button>

                  {cancelAttempts > 0 && (
                    <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-red-500 text-xs mt-1 font-medium bg-red-50 p-2 rounded-lg">
                      لا يمكن الإلغاء. إيقاف الكشاف يتطلب اشتراك بلس نشط!
                    </motion.p>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Exit Modal */}
      <AnimatePresence>
        {showExitModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl relative overflow-hidden text-center"
            >
              <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={32} />
              </div>
              
              <h2 className="text-xl font-bold text-white mb-2">تأكيد الخروج</h2>
              
              <p className="text-zinc-400 text-sm mb-6">
                {exitCount === 0 
                  ? "هل أنت متأكد أنك تريد الخروج من التطبيق وإطفاء الكشاف؟" 
                  : `يرجى التأكيد مرة أخرى للخروج. (التبقي: ${200 - exitCount})`}
              </p>

              <div className="space-y-3">
                <button
                  onClick={handleExitConfirm}
                  className="w-full bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold py-3 rounded-xl transition-colors shadow-lg shadow-red-600/20"
                >
                  {exitCount === 0 ? "نعم، أريد الخروج" : "تأكيد الخروج"}
                </button>
                
                <button
                  onClick={handleExitCancel}
                  className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-xl transition-colors"
                >
                  إلغاء والبقاء
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
