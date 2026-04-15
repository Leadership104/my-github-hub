import { useState, useEffect } from 'react';
import type { CryptoPrice, MetalPrice } from '../types';
import { useCurrencyConverter } from '../hooks';

interface Props {
  prices: CryptoPrice[];
  metals: MetalPrice[];
  onOpenMaps: () => void;
  onBack?: () => void;
}

export default function WalletScreen({ prices, metals, onOpenMaps, onBack }: Props) {
  const { convert, rates, currencies } = useCurrencyConverter();
  const [amount, setAmount] = useState('100');
  const [fromCur, setFromCur] = useState('USD');
  const [toCur, setToCur] = useState('BTC');
  const [result, setResult] = useState('');

  const btcPrice = prices.find(p => p.symbol === 'BTC')?.price || 0;
  const topCurrencies = ['USD', 'EUR', 'GBP', 'THB', 'JPY', 'IDR', 'BRL', 'MXN', 'PHP', 'KRW', 'AED', 'INR', 'BTC'];

  useEffect(() => {
    const num = parseFloat(amount);
    if (!isNaN(num) && num > 0) {
      const r = convert(num, fromCur, toCur, btcPrice);
      if (toCur === 'BTC') setResult(r.toFixed(8) + ' ₿');
      else if (fromCur === 'BTC') setResult('$' + r.toLocaleString(undefined, { maximumFractionDigits: 2 }));
      else setResult(r ? r.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—');
    } else setResult('—');
  }, [amount, fromCur, toCur, convert, btcPrice]);

  // FX rate display
  const fmtRate = (cur: string, symbol: string) => {
    if (!rates[cur]) return '—';
    if (cur === 'EUR' || cur === 'GBP') return '$' + (1 / rates[cur]).toFixed(4);
    return symbol + rates[cur].toFixed(2);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex-shrink-0">
        <h2 className="text-xl font-extrabold">💳 Wallet & Markets</h2>
      </div>
      <div className="flex-1 overflow-y-auto px-5 pb-24">

        {/* Currency Converter */}
        <div className="bg-card border border-border rounded-kipita p-5 mb-4">
          <div className="flex items-center gap-2 font-bold text-sm mb-1">
            <span className="ms text-kipita-green text-lg">currency_exchange</span> Currency Converter
            <span className="ml-auto text-[10px] font-semibold bg-kipita-green/20 text-kipita-green px-2 py-0.5 rounded-full">Live</span>
          </div>
          <div className="flex gap-2 items-stretch mt-3">
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
              className="flex-1 bg-background border border-border rounded-kipita-sm px-3 py-3 text-xl font-extrabold outline-none focus:border-kipita-red min-w-0" />
            <select value={fromCur} onChange={e => setFromCur(e.target.value)}
              className="bg-background border border-border rounded-kipita-sm px-2 py-2 font-bold text-sm cursor-pointer min-w-[100px]">
              {topCurrencies.filter(c => c === 'BTC' || currencies.includes(c)).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex justify-center my-2">
            <button onClick={() => { setFromCur(toCur); setToCur(fromCur); }}
              className="w-10 h-10 rounded-full bg-kipita-red-lt text-kipita-red flex items-center justify-center hover:bg-red-100 transition-colors">
              <span className="ms">swap_vert</span>
            </button>
          </div>
          <div className="flex gap-2 items-stretch">
            <div className="flex-1 bg-kipita-red-lt rounded-kipita-sm px-3 py-3 text-xl font-extrabold text-kipita-red min-w-0 overflow-hidden whitespace-nowrap text-ellipsis flex items-center">
              {result}
            </div>
            <select value={toCur} onChange={e => setToCur(e.target.value)}
              className="bg-background border border-border rounded-kipita-sm px-2 py-2 font-bold text-sm cursor-pointer min-w-[100px]">
              {topCurrencies.filter(c => c === 'BTC' || currencies.includes(c)).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* Crypto Prices */}
        <h3 className="font-bold text-sm mb-3">Live Crypto</h3>
        <div className="grid grid-cols-3 gap-3 mb-4">
          {prices.map(p => (
            <div key={p.symbol} className="bg-card border border-border rounded-kipita p-3.5">
              <div className="text-[10px] font-bold text-muted-foreground mb-1.5">{p.icon} {p.symbol}</div>
              <div className="text-sm font-extrabold">${p.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              <div className={`text-[10px] font-semibold mt-1 ${p.change24h >= 0 ? 'text-kipita-green' : 'text-kipita-red'}`}>
                {p.change24h >= 0 ? '▲ +' : '▼ '}{Math.abs(p.change24h).toFixed(2)}%
              </div>
            </div>
          ))}
        </div>

        {/* FX Rate Grid */}
        <h3 className="font-bold text-sm mb-3">Forex Rates</h3>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-card border border-border rounded-kipita p-3">
            <div className="text-[10px] font-bold text-muted-foreground">🇪🇺 EUR / USD</div>
            <div className="text-sm font-extrabold mt-1">{fmtRate('EUR', '€')}</div>
          </div>
          <div className="bg-card border border-border rounded-kipita p-3">
            <div className="text-[10px] font-bold text-muted-foreground">🇬🇧 GBP / USD</div>
            <div className="text-sm font-extrabold mt-1">{fmtRate('GBP', '£')}</div>
          </div>
          <div className="bg-card border border-border rounded-kipita p-3">
            <div className="text-[10px] font-bold text-muted-foreground">🇯🇵 JPY / USD</div>
            <div className="text-sm font-extrabold mt-1">{rates.JPY ? '¥' + rates.JPY.toFixed(2) : '—'}</div>
          </div>
          <div className="bg-card border border-border rounded-kipita p-3">
            <div className="text-[10px] font-bold text-muted-foreground">🇨🇳 CNY / USD</div>
            <div className="text-sm font-extrabold mt-1">{rates.CNY ? '¥' + rates.CNY.toFixed(4) : '—'}</div>
          </div>
        </div>

        {/* Metals */}
        {metals.length > 0 && (
          <>
            <h3 className="font-bold text-sm mb-3">🥇 Precious Metals</h3>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {metals.map(m => (
                <div key={m.symbol} className="bg-card border border-border rounded-kipita p-3">
                  <div className="text-[10px] font-bold text-muted-foreground">{m.label}</div>
                  <div className="text-xs font-extrabold mt-1">{m.price}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* BTC Map promo */}
        <button onClick={onOpenMaps}
          className="w-full bg-gradient-to-r from-[#F7931A] to-[#E07500] rounded-kipita p-4 flex items-center justify-between text-white font-bold text-sm hover:opacity-90 transition-opacity">
          <span>₿ Find BTC merchants nearby</span>
          <span className="ms text-lg">arrow_forward</span>
        </button>

      </div>
    </div>
  );
}
