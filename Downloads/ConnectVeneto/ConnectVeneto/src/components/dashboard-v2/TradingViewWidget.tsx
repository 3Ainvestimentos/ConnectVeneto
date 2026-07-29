"use client";

import { useTheme } from '@/contexts/ThemeContext';
import React, { useEffect, useRef } from 'react';

const TradingViewWidget: React.FC = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const { theme } = useTheme();

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        // Garante que o elemento widget existe antes de continuar
        const widgetDiv = container.querySelector('.tradingview-widget-container__widget');
        if (!widgetDiv) {
            console.warn('TradingView widget container not found');
            return;
        }

        // Limpa scripts anteriores para evitar duplicação
        const existingScripts = container.querySelectorAll('script[src*="embed-widget-market-overview"]');
        existingScripts.forEach(script => {
            script.remove();
        });

        // Limpa qualquer conteúdo anterior do widget
        widgetDiv.innerHTML = '';

        // Aguarda o próximo frame para garantir que o DOM está completamente renderizado
        const rafId = requestAnimationFrame(() => {
            const currentContainer = containerRef.current;
            if (!currentContainer) return;

            const currentWidget = currentContainer.querySelector('.tradingview-widget-container__widget');
            if (!currentWidget) {
                console.warn('TradingView widget element not found after RAF');
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js';
            script.async = true;
            script.type = 'text/javascript';
            
            // Adiciona tratamento de erro no script
            script.onerror = () => {
                console.warn('TradingView widget failed to load');
            };
            
            // Define o conteúdo do script
            try {
                const widgetConfig = {
                    "colorTheme": theme,
                    "dateRange": "12M",
                    "locale": "br",
                    "largeChartUrl": "",
                    "isTransparent": true,
                    "showFloatingTooltip": true,
                    "plotLineColorGrowing": "rgba(0, 166, 126, 1)",
                    "plotLineColorFalling": "rgba(221, 51, 51, 1)",
                    "gridLineColor": "rgba(240, 243, 250, 0)",
                    "scaleFontColor": theme === 'dark' ? "rgba(209, 213, 219, 1)" : "#0F0F0F",
                    "belowLineFillColorGrowing": "rgba(0, 166, 126, 0.12)",
                    "belowLineFillColorFalling": "rgba(221, 51, 51, 0.12)",
                    "belowLineFillColorGrowingBottom": "rgba(41, 98, 255, 0)",
                    "belowLineFillColorFallingBottom": "rgba(41, 98, 255, 0)",
                    "symbolActiveColor": "rgba(0, 166, 126, 0.12)",
                    "tabs": [
                        {
                            "title": "Moedas",
                            "symbols": [
                                { "s": "FX_IDC:USDBRL", "d": "USD/BRL" },
                                { "s": "FX_IDC:EURBRL", "d": "EUR/BRL" },
                                { "s": "FX:EURUSD", "d": "EUR/USD" },
                                { "s": "CMCMARKETS:GBPUSD", "d": "GBP/USD" }
                            ],
                            "originalTitle": "Forex"
                        },
                        {
                            "title": "Índices",
                            "symbols": [
                                { "s": "BMFBOVESPA:IBOV", "d": "Ibovespa" },
                                { "s": "BMFBOVESPA:IFIX", "d": "IFIX" }
                            ],
                            "originalTitle": "Indices"
                        },
                        {
                            "title": "Futuros",
                            "symbols": [
                                { "s": "BMFBOVESPA:T101!", "d": "Treasure 10 anos" },
                                { "s": "BMFBOVESPA:IND1!", "d": "Ibovespa Futuro" },
                                { "s": "BMFBOVESPA:ISP1!", "d": "S&P 500 Futuro" },
                                { "s": "BMFBOVESPA:DI11!", "d": "DI Futuro" }
                            ]
                        }
                    ],
                    "support_host": "https://www.tradingview.com",
                    "width": "100%",
                    "height": "100%"
                };

                script.innerHTML = JSON.stringify(widgetConfig);

                // Adiciona o script dentro do widget div (padrão TradingView)
                if (currentWidget && containerRef.current === currentContainer) {
                    currentWidget.appendChild(script);
                }
            } catch (error) {
                console.error('Error setting TradingView widget content:', error);
            }
        });

        // Função de limpeza
        return () => {
            cancelAnimationFrame(rafId);
            if (container) {
                // Remove apenas os scripts, mantém a estrutura do widget
                const scripts = container.querySelectorAll('script[src*="embed-widget-market-overview"]');
                scripts.forEach(script => script.remove());
            }
        };

    }, [theme]); // Recria o widget quando o tema muda

    return (
        <div ref={containerRef} className="tradingview-widget-container h-full">
            <div className="tradingview-widget-container__widget h-full"></div>
        </div>
    );
};

export default TradingViewWidget;
