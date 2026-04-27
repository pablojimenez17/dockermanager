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
        <div className="w-full bg-slate-100 dark:bg-slate-800/50 rounded-xl p-3 flex flex-col items-center justify-center min-h-[120px] border border-slate-200 dark:border-slate-700 relative overflow-hidden group">
            {/* The actual ad container would be populated by the external script */}
            <ins className="adsbygoogle"
                 style={{ display: 'block', minHeight: '90px', width: '100%' }}
                 data-ad-client="ca-pub-XXXXXXXXXXXXXXX"
                 data-ad-slot="XXXXXXXXXX"
                 data-ad-format="auto"
                 data-full-width-responsive="true"></ins>
            
            {/* Fallback text when ads are blocked or loading */}
            <span className="text-[10px] text-slate-400 absolute opacity-50 z-0 font-bold tracking-widest uppercase">Advertisement</span>
            
            {/* Upsell to remove ads on hover */}
            <NavLink to="/app/plans" className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity text-[9px] bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-500 dark:text-slate-300 hover:text-brand-500 dark:hover:text-brand-400 font-semibold z-10">
                Remove ads
            </NavLink>
        </div>
    );
};

export default AdBanner;
