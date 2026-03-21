import { useState, useEffect } from 'react';
import type { CryptoPrice } from '../types';
import { useCurrencyConverter } from '../hooks';

interface Props {
  prices: CryptoPrice[];
  onOpenMaps: () => void;
}

export default function WalletScreen({ prices, onOpenMaps }: Props) {
  const { convert, currencies } = useCurrencyConverter();
  const [amount, setAmount] = useState('100');
  const [fromCur, setFromCur] = useState('USD');
  const [toCur, setToCur] = useState('THB');
  const [result, setResult] = useState('');

  useEffect(() => {
    const num = parseFloat(amount);
    if (!isNaN(num) && num > 0) {
      const r = convert(num, fromCur, toCur);
      setResult(r ? r.toFixed(2) : '—');
    } else setResult('—');
  }, [amount, fromCur, toCur, convert]);

  const btcPrice = prices.find(p => p.symbol === 'BTC')?.price || 0;
  const topCurrencies = ['USD', 'EUR', 'GBP', 'THB', 'JPY', 'IDR', 'BRL', 'MXN', 'PHP', 'KRW', 'AED', 'INR'];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex-shrink-0">
        <h2 className="text-xl font-extrabold">Wallet</h2>
      </div>
      <div className="flex-1 overflow-y-auto px-5 pb-24">
        {/* Wallet card */}
        <div className="bg-gradient-to-br from-[#1e1b4b] to-[#2d1b6e] rounded-kipita p-5 mb-4">
          <div className="text-xs text-purple-300 font-semibold mb-1">BTC Balance</div>
          <div className="text-2xl text-white font-extrabold">0.00000000</div>
          <div className="text-xs text-purple-200/60 mt-1">{btcPrice ? `≈ $0.00 USD` : 'Loading…'}</div>
          <div className="flex gap-2 mt-4">
            <button className="flex-1 bg-white/15 text-white py-2.5 rounded-kipita-sm text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-white/25 transition-colors">
              <span className="ms text-base">arrow_upward</span> Send
            </button>
            <button className="flex-1 bg-[rgba(34,197,94,.3)] text-white py-2.5 rounded-kipita-sm text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-[rgba(34,197,94,.4)] transition-colors">
              <span className="ms text-base">arrow_downward</span> Receive
            </button>
          </div>
        </div>

        {/* Currency Converter */}
        <div className="bg-card border border-border rounded-kipita p-5 mb-4">
          <div className="flex items-center gap-2 font-bold text-sm mb-4">
            <span className="text-kipita-green text-lg">💱</span> Currency Converter
          </div>
          <div className="flex gap-2 items-stretch">
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
              className="flex-1 bg-background border border-border rounded-kipita-sm px-3 py-3 text-xl font-extrabold outline-none focus:border-kipita-red min-w-0" />
            <select value={fromCur} onChange={e => setFromCur(e.target.value)}
              className="bg-background border border-border rounded-kipita-sm px-2 py-2 font-bold text-sm cursor-pointer min-w-[100px]">
              {topCurrencies.filter(c => currencies.includes(c)).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex justify-center my-2">
            <button onClick={() => { setFromCur(toCur); setToCur(fromCur); }}
              className="w-10 h-10 rounded-full bg-kipita-red-lt text-kipita-red flex items-center justify-center hover:bg-red-100 transition-colors">
              <span className="ms">swap_vert</span>
            </button>
          </div>
          <div className="flex gap-2 items-stretch">
            <div className="flex-1 bg-kipita-red-lt rounded-kipita-sm px-3 py-3 text-xl font-extrabold text-kipita-red min-w-0 break-all flex items-center">
              {result}
            </div>
            <select value={toCur} onChange={e => setToCur(e.target.value)}
              className="bg-background border border-border rounded-kipita-sm px-2 py-2 font-bold text-sm cursor-pointer min-w-[100px]">
              {topCurrencies.filter(c => currencies.includes(c)).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* Crypto Prices */}
        <h3 className="font-bold text-sm mb-3">Live Crypto Prices</h3>
        <div className="grid grid-cols-3 gap-3 mb-4">
          {prices.map(p => (
            <div key={p.symbol} className="bg-card border border-border rounded-kipita p-3.5">
              <div className="text-[10px] font-bold text-muted-foreground mb-1.5">{p.icon} {p.symbol}</div>
              <div className="text-sm font-extrabold">${p.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              <div className={`text-[10px] font-semibold mt-1 ${p.change24h >= 0 ? 'text-kipita-green' : 'text-kipita-red'}`}>
                {p.change24h >= 0 ? '▲' : '▼'} {Math.abs(p.change24h).toFixed(1)}%
              </div>
            </div>
          ))}
        </div>

        {/* BTC Map promo */}
        <button onClick={onOpenMaps}
          className="w-full bg-gradient-to-r from-[#F7931A] to-[#E07500] rounded-kipita p-4 flex items-center justify-between text-white font-bold text-sm hover:opacity-90 transition-opacity">
          <span>₿ Find BTC merchants nearby</span>
          <span className="ms text-lg">arrow_forward</span>
        </button>

        {/* Transactions */}
        <h3 className="font-bold text-sm mt-5 mb-3">Recent Transactions</h3>
        <div className="bg-card border border-border rounded-kipita overflow-hidden">
          {[
            { type: 'received', label: 'Received BTC', amount: '+0.00142', usd: '+$91.20', time: '2h ago', icon: '↓' },
            { type: 'sent', label: 'Sent to Café', amount: '-0.00008', usd: '-$5.12', time: 'Yesterday', icon: '↑' },
            { type: 'received', label: 'Lightning Payment', amount: '+0.00021', usd: '+$13.44', time: '3 days ago', icon: '⚡' },
          ].map((tx, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3.5 border-b border-border last:border-b-0">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0 ${tx.type === 'received' ? 'bg-green-50' : 'bg-red-50'}`}>{tx.icon}</div>
              <div className="flex-1">
                <div className="text-sm font-semibold">{tx.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{tx.time}</div>
              </div>
              <div className="text-right">
                <div className={`text-sm font-bold ${tx.type === 'received' ? 'text-kipita-green' : 'text-kipita-red'}`}>{tx.amount}</div>
                <div className="text-[10px] text-muted-foreground">{tx.usd}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
