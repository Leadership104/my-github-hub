import { useState, useEffect } from 'react';
import type { CryptoPrice, MetalPrice } from '../types';
import { useCurrencyConverter } from '../hooks';

interface Props {
  prices: CryptoPrice[];
  metals: MetalPrice[];
  onOpenMaps: () => void;
  onBack?: () => void;
}

type FilterTab = 'currency' | 'crypto' | 'commodities';

export default function WalletScreen({ prices, metals, onOpenMaps, onBack }: Props) {
  const { convert, rates, currencies } = useCurrencyConverter();
  const [amount, setAmount] = useState('100');
  const [fromCur, setFromCur] = useState('EUR');
  const [toCur, setToCur] = useState('USD');
  const [result, setResult] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('currency');

  const btcPrice = prices.find(p => p.symbol === 'BTC')?.price || 0;
  const ethPrice = prices.find(p => p.symbol === 'ETH')?.price || 0;

  // Comprehensive currency metadata: code -> { flag, country }
  const CURRENCY_META: Record<string, { flag: string; country: string }> = {
    USD: { flag: '🇺🇸', country: 'United States' },
    EUR: { flag: '🇪🇺', country: 'Eurozone' },
    GBP: { flag: '🇬🇧', country: 'United Kingdom' },
    JPY: { flag: '🇯🇵', country: 'Japan' },
    CNY: { flag: '🇨🇳', country: 'China' },
    CHF: { flag: '🇨🇭', country: 'Switzerland' },
    AED: { flag: '🇦🇪', country: 'UAE' },
    AFN: { flag: '🇦🇫', country: 'Afghanistan' },
    ALL: { flag: '🇦🇱', country: 'Albania' },
    AMD: { flag: '🇦🇲', country: 'Armenia' },
    ANG: { flag: '🇨🇼', country: 'Curaçao' },
    AOA: { flag: '🇦🇴', country: 'Angola' },
    ARS: { flag: '🇦🇷', country: 'Argentina' },
    AUD: { flag: '🇦🇺', country: 'Australia' },
    AWG: { flag: '🇦🇼', country: 'Aruba' },
    AZN: { flag: '🇦🇿', country: 'Azerbaijan' },
    BAM: { flag: '🇧🇦', country: 'Bosnia & Herzegovina' },
    BBD: { flag: '🇧🇧', country: 'Barbados' },
    BDT: { flag: '🇧🇩', country: 'Bangladesh' },
    BGN: { flag: '🇧🇬', country: 'Bulgaria' },
    BHD: { flag: '🇧🇭', country: 'Bahrain' },
    BIF: { flag: '🇧🇮', country: 'Burundi' },
    BMD: { flag: '🇧🇲', country: 'Bermuda' },
    BND: { flag: '🇧🇳', country: 'Brunei' },
    BOB: { flag: '🇧🇴', country: 'Bolivia' },
    BRL: { flag: '🇧🇷', country: 'Brazil' },
    BSD: { flag: '🇧🇸', country: 'Bahamas' },
    BTN: { flag: '🇧🇹', country: 'Bhutan' },
    BWP: { flag: '🇧🇼', country: 'Botswana' },
    BYN: { flag: '🇧🇾', country: 'Belarus' },
    BZD: { flag: '🇧🇿', country: 'Belize' },
    CAD: { flag: '🇨🇦', country: 'Canada' },
    CDF: { flag: '🇨🇩', country: 'DR Congo' },
    CLP: { flag: '🇨🇱', country: 'Chile' },
    COP: { flag: '🇨🇴', country: 'Colombia' },
    CRC: { flag: '🇨🇷', country: 'Costa Rica' },
    CUP: { flag: '🇨🇺', country: 'Cuba' },
    CVE: { flag: '🇨🇻', country: 'Cape Verde' },
    CZK: { flag: '🇨🇿', country: 'Czech Republic' },
    DJF: { flag: '🇩🇯', country: 'Djibouti' },
    DKK: { flag: '🇩🇰', country: 'Denmark' },
    DOP: { flag: '🇩🇴', country: 'Dominican Republic' },
    DZD: { flag: '🇩🇿', country: 'Algeria' },
    EGP: { flag: '🇪🇬', country: 'Egypt' },
    ERN: { flag: '🇪🇷', country: 'Eritrea' },
    ETB: { flag: '🇪🇹', country: 'Ethiopia' },
    FJD: { flag: '🇫🇯', country: 'Fiji' },
    FKP: { flag: '🇫🇰', country: 'Falkland Islands' },
    GEL: { flag: '🇬🇪', country: 'Georgia' },
    GHS: { flag: '🇬🇭', country: 'Ghana' },
    GIP: { flag: '🇬🇮', country: 'Gibraltar' },
    GMD: { flag: '🇬🇲', country: 'Gambia' },
    GNF: { flag: '🇬🇳', country: 'Guinea' },
    GTQ: { flag: '🇬🇹', country: 'Guatemala' },
    GYD: { flag: '🇬🇾', country: 'Guyana' },
    HKD: { flag: '🇭🇰', country: 'Hong Kong' },
    HNL: { flag: '🇭🇳', country: 'Honduras' },
    HRK: { flag: '🇭🇷', country: 'Croatia' },
    HTG: { flag: '🇭🇹', country: 'Haiti' },
    HUF: { flag: '🇭🇺', country: 'Hungary' },
    IDR: { flag: '🇮🇩', country: 'Indonesia' },
    ILS: { flag: '🇮🇱', country: 'Israel' },
    INR: { flag: '🇮🇳', country: 'India' },
    IQD: { flag: '🇮🇶', country: 'Iraq' },
    IRR: { flag: '🇮🇷', country: 'Iran' },
    ISK: { flag: '🇮🇸', country: 'Iceland' },
    JMD: { flag: '🇯🇲', country: 'Jamaica' },
    JOD: { flag: '🇯🇴', country: 'Jordan' },
    KES: { flag: '🇰🇪', country: 'Kenya' },
    KGS: { flag: '🇰🇬', country: 'Kyrgyzstan' },
    KHR: { flag: '🇰🇭', country: 'Cambodia' },
    KMF: { flag: '🇰🇲', country: 'Comoros' },
    KRW: { flag: '🇰🇷', country: 'South Korea' },
    KWD: { flag: '🇰🇼', country: 'Kuwait' },
    KYD: { flag: '🇰🇾', country: 'Cayman Islands' },
    KZT: { flag: '🇰🇿', country: 'Kazakhstan' },
    LAK: { flag: '🇱🇦', country: 'Laos' },
    LBP: { flag: '🇱🇧', country: 'Lebanon' },
    LKR: { flag: '🇱🇰', country: 'Sri Lanka' },
    LRD: { flag: '🇱🇷', country: 'Liberia' },
    LSL: { flag: '🇱🇸', country: 'Lesotho' },
    LYD: { flag: '🇱🇾', country: 'Libya' },
    MAD: { flag: '🇲🇦', country: 'Morocco' },
    MDL: { flag: '🇲🇩', country: 'Moldova' },
    MGA: { flag: '🇲🇬', country: 'Madagascar' },
    MKD: { flag: '🇲🇰', country: 'North Macedonia' },
    MMK: { flag: '🇲🇲', country: 'Myanmar' },
    MNT: { flag: '🇲🇳', country: 'Mongolia' },
    MOP: { flag: '🇲🇴', country: 'Macau' },
    MRU: { flag: '🇲🇷', country: 'Mauritania' },
    MUR: { flag: '🇲🇺', country: 'Mauritius' },
    MVR: { flag: '🇲🇻', country: 'Maldives' },
    MWK: { flag: '🇲🇼', country: 'Malawi' },
    MXN: { flag: '🇲🇽', country: 'Mexico' },
    MYR: { flag: '🇲🇾', country: 'Malaysia' },
    MZN: { flag: '🇲🇿', country: 'Mozambique' },
    NAD: { flag: '🇳🇦', country: 'Namibia' },
    NGN: { flag: '🇳🇬', country: 'Nigeria' },
    NIO: { flag: '🇳🇮', country: 'Nicaragua' },
    NOK: { flag: '🇳🇴', country: 'Norway' },
    NPR: { flag: '🇳🇵', country: 'Nepal' },
    NZD: { flag: '🇳🇿', country: 'New Zealand' },
    OMR: { flag: '🇴🇲', country: 'Oman' },
    PAB: { flag: '🇵🇦', country: 'Panama' },
    PEN: { flag: '🇵🇪', country: 'Peru' },
    PGK: { flag: '🇵🇬', country: 'Papua New Guinea' },
    PHP: { flag: '🇵🇭', country: 'Philippines' },
    PKR: { flag: '🇵🇰', country: 'Pakistan' },
    PLN: { flag: '🇵🇱', country: 'Poland' },
    PYG: { flag: '🇵🇾', country: 'Paraguay' },
    QAR: { flag: '🇶🇦', country: 'Qatar' },
    RON: { flag: '🇷🇴', country: 'Romania' },
    RSD: { flag: '🇷🇸', country: 'Serbia' },
    RUB: { flag: '🇷🇺', country: 'Russia' },
    RWF: { flag: '🇷🇼', country: 'Rwanda' },
    SAR: { flag: '🇸🇦', country: 'Saudi Arabia' },
    SBD: { flag: '🇸🇧', country: 'Solomon Islands' },
    SCR: { flag: '🇸🇨', country: 'Seychelles' },
    SDG: { flag: '🇸🇩', country: 'Sudan' },
    SEK: { flag: '🇸🇪', country: 'Sweden' },
    SGD: { flag: '🇸🇬', country: 'Singapore' },
    SLL: { flag: '🇸🇱', country: 'Sierra Leone' },
    SOS: { flag: '🇸🇴', country: 'Somalia' },
    SRD: { flag: '🇸🇷', country: 'Suriname' },
    SSP: { flag: '🇸🇸', country: 'South Sudan' },
    STN: { flag: '🇸🇹', country: 'São Tomé & Príncipe' },
    SYP: { flag: '🇸🇾', country: 'Syria' },
    SZL: { flag: '🇸🇿', country: 'Eswatini' },
    THB: { flag: '🇹🇭', country: 'Thailand' },
    TJS: { flag: '🇹🇯', country: 'Tajikistan' },
    TMT: { flag: '🇹🇲', country: 'Turkmenistan' },
    TND: { flag: '🇹🇳', country: 'Tunisia' },
    TOP: { flag: '🇹🇴', country: 'Tonga' },
    TRY: { flag: '🇹🇷', country: 'Turkey' },
    TTD: { flag: '🇹🇹', country: 'Trinidad & Tobago' },
    TWD: { flag: '🇹🇼', country: 'Taiwan' },
    TZS: { flag: '🇹🇿', country: 'Tanzania' },
    UAH: { flag: '🇺🇦', country: 'Ukraine' },
    UGX: { flag: '🇺🇬', country: 'Uganda' },
    UYU: { flag: '🇺🇾', country: 'Uruguay' },
    UZS: { flag: '🇺🇿', country: 'Uzbekistan' },
    VES: { flag: '🇻🇪', country: 'Venezuela' },
    VND: { flag: '🇻🇳', country: 'Vietnam' },
    VUV: { flag: '🇻🇺', country: 'Vanuatu' },
    WST: { flag: '🇼🇸', country: 'Samoa' },
    XAF: { flag: '🌍', country: 'Central African CFA' },
    XCD: { flag: '🌎', country: 'East Caribbean' },
    XOF: { flag: '🌍', country: 'West African CFA' },
    XPF: { flag: '🇵🇫', country: 'CFP Franc' },
    YER: { flag: '🇾🇪', country: 'Yemen' },
    ZAR: { flag: '🇿🇦', country: 'South Africa' },
    ZMW: { flag: '🇿🇲', country: 'Zambia' },
    ZWL: { flag: '🇿🇼', country: 'Zimbabwe' },
  };

  // Top 6 most popular for travel/business
  const POPULAR_FIATS = ['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'CHF'];

  // Currency options based on active filter
  const getCurrencyOptions = () => {
    // All known fiats from metadata, intersected with live rates when available
    const allFiats = Object.keys(CURRENCY_META);
    const available = currencies.length
      ? allFiats.filter(c => currencies.includes(c))
      : allFiats;
    const popular = POPULAR_FIATS.filter(c => available.includes(c));
    const rest = available
      .filter(c => !POPULAR_FIATS.includes(c))
      .sort((a, b) => CURRENCY_META[a].country.localeCompare(CURRENCY_META[b].country));
    const fiatCurrencies = [...popular, ...rest];
    const cryptoCurrencies = ['BTC', 'ETH'];
    const commodities = ['XAU', 'XAG']; // Gold, Silver

    switch (filterTab) {
      case 'crypto': return [...cryptoCurrencies, ...fiatCurrencies];
      case 'commodities': return [...commodities, ...fiatCurrencies];
      default: return fiatCurrencies;
    }
  };

  const currencyOptions = getCurrencyOptions();

  // Reset selections when filter changes
  useEffect(() => {
    if (filterTab === 'crypto') { setFromCur('BTC'); setToCur('USD'); }
    else if (filterTab === 'commodities') { setFromCur('XAU'); setToCur('USD'); }
    else { setFromCur('EUR'); setToCur('USD'); }
  }, [filterTab]);

  const labelFor = (cur: string) => {
    const labels: Record<string, string> = {
      BTC: '₿ BTC', ETH: 'Ξ ETH',
      XAU: '🥇 XAU', XAG: '🥈 XAG',
    };
    if (labels[cur]) return labels[cur];
    const meta = CURRENCY_META[cur];
    return meta ? `${meta.flag} ${cur}` : cur;
  };

  useEffect(() => {
    const num = parseFloat(amount);
    if (!isNaN(num) && num > 0) {
      let r: number;
      if (fromCur === 'BTC' || toCur === 'BTC') {
        r = convert(num, fromCur, toCur, btcPrice);
      } else if (fromCur === 'ETH' || toCur === 'ETH') {
        r = convert(num, fromCur, toCur, ethPrice);
      } else if (fromCur === 'XAU' || toCur === 'XAU') {
        const goldMetal = metals.find(m => m.symbol === 'XAU');
        const goldPrice = goldMetal ? parseFloat(goldMetal.price.replace(/[^0-9.]/g, '')) || 2400 : 2400;
        if (fromCur === 'XAU') r = num * goldPrice * (rates[toCur] || 1);
        else r = num / (rates[fromCur] || 1) / goldPrice;
      } else if (fromCur === 'XAG' || toCur === 'XAG') {
        const silverMetal = metals.find(m => m.symbol === 'XAG');
        const silverPrice = silverMetal ? parseFloat(silverMetal.price.replace(/[^0-9.]/g, '')) || 28 : 28;
        if (fromCur === 'XAG') r = num * silverPrice * (rates[toCur] || 1);
        else r = num / (rates[fromCur] || 1) / silverPrice;
      } else {
        r = convert(num, fromCur, toCur, btcPrice);
      }

      if (toCur === 'BTC') setResult(r.toFixed(8) + ' ₿');
      else if (toCur === 'ETH') setResult(r.toFixed(6) + ' Ξ');
      else if (toCur === 'XAU') setResult(r.toFixed(4) + ' oz');
      else if (toCur === 'XAG') setResult(r.toFixed(4) + ' oz');
      else setResult(r ? r.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—');
    } else setResult('—');
  }, [amount, fromCur, toCur, convert, btcPrice, ethPrice, rates, metals]);

  const fmtRate = (cur: string, symbol: string) => {
    if (!rates[cur]) return '—';
    if (cur === 'EUR' || cur === 'GBP') return '$' + (1 / rates[cur]).toFixed(4);
    return symbol + rates[cur].toFixed(2);
  };

  const filterTabs: { id: FilterTab; label: string; icon: string }[] = [
    { id: 'currency', label: 'Currency', icon: '💱' },
    { id: 'crypto', label: 'Crypto', icon: '₿' },
    { id: 'commodities', label: 'Commodities', icon: '🥇' },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden screen-enter">
      <div className="px-5 pt-5 pb-3 flex-shrink-0">
        <h2 className="text-xl font-extrabold">💳 Wallet & Markets</h2>
      </div>
      <div className="flex-1 overflow-y-auto px-5 pb-24">

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-4">
          {filterTabs.map(ft => (
            <button key={ft.id} onClick={() => setFilterTab(ft.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-kipita-sm text-xs font-bold transition-all ${filterTab === ft.id ? 'bg-kipita-red text-white' : 'bg-card border border-border text-muted-foreground hover:bg-muted'}`}>
              <span>{ft.icon}</span>
              <span>{ft.label}</span>
            </button>
          ))}
        </div>

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
              className="bg-background border border-border rounded-kipita-sm px-2 py-2 font-bold text-xs cursor-pointer w-[88px] flex-shrink-0">
              {currencyOptions.filter(c => ['BTC','ETH','XAU','XAG'].includes(c) || currencies.includes(c)).map(c => <option key={c} value={c}>{labelFor(c)}</option>)}
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
              className="bg-background border border-border rounded-kipita-sm px-2 py-2 font-bold text-xs cursor-pointer w-[88px] flex-shrink-0">
              {currencyOptions.filter(c => ['BTC','ETH','XAU','XAG'].includes(c) || currencies.includes(c)).map(c => <option key={c} value={c}>{labelFor(c)}</option>)}
            </select>
          </div>
        </div>

        {/* Crypto Prices — only BTC and ETH */}
        <h3 className="font-bold text-sm mb-3">Live Crypto</h3>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {prices.filter(p => p.symbol === 'BTC' || p.symbol === 'ETH').map(p => (
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

        {/* Precious Metals / Commodities */}
        {metals.length > 0 && (
          <>
            <h3 className="font-bold text-sm mb-3">🥇 Precious Metals</h3>
            <div className="grid grid-cols-2 gap-3 mb-4">
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
