import React, { useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { useOrg } from '../context/OrgContext';

const AdBanner = () => {
    const { userPlan, activeOrg } = useOrg();
    const adRef = useRef(null);
    const pushed = useRef(false);

    const plan = (activeOrg ? activeOrg.plan : userPlan) || 'free';
    
    // Always call hooks before conditional returns, but render nothing if not free
    useEffect(() => {
        if (plan !== 'free') return;

        const el = adRef.current;
        if (!el || pushed.current) return;

        // AdSense needs a non-zero width to render. The sidebar might not
        // be laid out yet when this effect first runs, so we observe until
        // the element actually has width before calling push().
        const tryPush = () => {
            if (pushed.current) return;
            if (el.dataset.adsbygoogleStatus) return; // already filled
            if (el.offsetWidth === 0) return; // not visible yet

            try {
                (window.adsbygoogle = window.adsbygoogle || []).push({});
                pushed.current = true;
            } catch (e) {
                // Silently ignore — ad blockers or duplicate push errors
            }
        };

        // Try immediately in case layout is already done
        tryPush();

        // If it didn't work, observe for resize (sidebar expand, etc.)
        if (!pushed.current) {
            const observer = new ResizeObserver(() => {
                tryPush();
                if (pushed.current) observer.disconnect();
            });
            observer.observe(el);
            return () => observer.disconnect();
        }
    }, []);

    if (plan !== 'free') return null;

    return (
        <div className="w-full bg-gray-100 dark:bg-slate-800 rounded p-2 flex flex-col items-center justify-center min-h-[100px] border border-gray-200 dark:border-slate-700 relative overflow-hidden group">
            <ins className="adsbygoogle"
                 ref={adRef}
                 style={{ display: 'block', minHeight: '90px', width: '100%' }}
                 data-ad-client="ca-pub-6070230906652526"
                 data-ad-slot="6282568435"
                 data-ad-format="auto"
                 data-full-width-responsive="true"></ins>
            
            {/* Fallback text when ads are blocked or loading */}
            <span className="text-[10px] text-gray-400 dark:text-slate-500 absolute opacity-50 z-0 font-medium">Advertisement</span>
            
            {/* Upsell to remove ads on hover */}
            <NavLink to="/app/plans" className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 px-2 py-0.5 rounded text-gray-500 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400 font-medium z-10 shadow-sm">
                Remove ads
            </NavLink>
        </div>
    );
};

export default AdBanner;

