/**
 * Vercel Speed Insights initialization
 * This script initializes Speed Insights for static HTML pages.
 * It will automatically collect Web Vitals metrics when deployed on Vercel.
 */

(function() {
  'use strict';
  
  // Initialize the Speed Insights queue
  window.si = window.si || function() {
    (window.siq = window.siq || []).push(arguments);
  };

  // Load the Speed Insights script from Vercel's CDN
  // This script is automatically served when Speed Insights is enabled in the Vercel dashboard
  var script = document.createElement('script');
  script.src = '/_vercel/speed-insights/script.js';
  script.defer = true;
  
  // Handle script load errors gracefully (e.g., in development)
  script.onerror = function() {
    console.log('Speed Insights: Not available (enable in Vercel dashboard when deployed)');
  };
  
  document.head.appendChild(script);
})();
