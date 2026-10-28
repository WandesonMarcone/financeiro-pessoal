import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig({
 plugins:[react(),VitePWA({
  registerType:'autoUpdate',
  includeAssets:['icon.svg','icon-192.png','icon-512.png'],
  manifest:{
   name:'Nossa Casa — Gestão Financeira',short_name:'Nossa Casa',description:'Gestão financeira familiar privada',
   theme_color:'#174d3c',background_color:'#f5f3ed',display:'standalone',start_url:'/',scope:'/',lang:'pt-BR',
   icons:[
    {src:'/icon-192.png',sizes:'192x192',type:'image/png'},
    {src:'/icon-512.png',sizes:'512x512',type:'image/png'},
    {src:'/icon-512.png',sizes:'512x512',type:'image/png',purpose:'maskable'}
   ]
  },
  workbox:{
   cleanupOutdatedCaches:true,navigateFallback:'/index.html',globIgnores:['**/tesseract/**'],
   runtimeCaching:[{urlPattern:({url})=>url.pathname.startsWith('/tesseract/'),handler:'CacheFirst',options:{cacheName:'nossa-casa-ocr-v1',expiration:{maxEntries:4,maxAgeSeconds:31536000}}}]
  }
 })],
 test:{environment:'jsdom',setupFiles:['./tests/setup.ts'],include:['tests/**/*.test.ts','tests/**/*.test.tsx']}
});

