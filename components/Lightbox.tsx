import React, { useEffect } from 'react';

interface LightboxProps {
    photoUrl: string | null;
    onClose: () => void;
}

export const Lightbox: React.FC<LightboxProps> = ({ photoUrl, onClose }) => {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        if (photoUrl) {
            document.addEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'hidden'; // Prevent scrolling when lightbox is open
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
        };
    }, [photoUrl, onClose]);

    if (!photoUrl) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-xl animate-in fade-in duration-300"
            onClick={onClose}
        >
            <div className="absolute top-4 right-4 z-[60]">
                <button
                    onClick={onClose}
                    className="text-white/90 hover:text-white transition-colors p-2 bg-black/20 hover:bg-black/40 rounded-full show-shadow"
                    aria-label="Close"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-md">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>

            <div
                className="relative max-w-[95vw] max-h-[95vh] md:max-w-[90vw] md:max-h-[90vh] p-2 md:p-4 group"
                onClick={(e) => e.stopPropagation()} // Prevent closing when clicking the image wrapper
            >
                <img
                    src={photoUrl}
                    alt="Memory"
                    className="max-w-full max-h-[85vh] object-contain rounded-sm shadow-[0_0_50px_rgba(0,0,0,0.5)] border-8 border-white transform transition-transform duration-500 hover:scale-[1.02]"
                />

                {/* Caption/Footer */}
                <div className="absolute bottom-[-3rem] left-0 w-full text-center">
                    <p className="text-white/80 font-serif tracking-widest text-sm">MERRY CHRISTMAS</p>
                </div>
            </div>
        </div>
    );
};
