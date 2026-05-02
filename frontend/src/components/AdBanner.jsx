import React, { useEffect } from 'react';
import { NavLink } from 'react-router-dom';

const AdBanner = () => {
    useEffect(() => {
        try {
            // Mock initialization for AdSense or similar ad network
            (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch (e) {
            console.error("AdSense error", e);
        }
    }, []);

    return (
        <div className="w-full bg-[#030305] rounded-sm p-3 flex flex-col items-center justify-center min-h-[120px] border border-surface-border shadow-inner relative overflow-hidden group">
            {/* The actual ad container would be populated by the external script */}
            <ins className="adsbygoogle"
                 style={{ display: 'block', minHeight: '90px', width: '100%' }}
                 data-ad-client="ca-pub-6070230906652526"
                 data-ad-slot="6282568435"
                 data-ad-format="auto"
                 data-full-width-responsive="true"></ins>
            
            {/* Fallback text when ads are blocked or loading */}
            <span className="text-[9px] text-slate-600 absolute opacity-30 z-0 font-display tracking-widest uppercase">Telemetry System Offline</span>
            
            {/* Upsell to remove ads on hover */}
            <NavLink to="/app/plans" className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity text-[9px] bg-brand-500/10 border border-brand-500/30 px-1.5 py-0.5 rounded-sm text-brand-400 hover:bg-brand-500 hover:text-white font-semibold z-10 font-display uppercase tracking-wider">
                Remove
            </NavLink>
        </div>
    );
};

export default AdBanner;
