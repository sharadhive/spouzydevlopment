/**
 * Small animated SVG charts for the dashboard (no chart library needed).
 * Donut / pie, vertical bars (grouped or stacked), horizontal bars, line / area, gauge, funnel,
 * count-up numbers and sparklines. Every chart animates in when it first appears and shows
 * exact values on hover.
 */
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

export const PALETTE = ['#7A2E45', '#B5653A', '#2A7F8E', '#C5A059', '#6B4E8A', '#2E7D32', '#D7848F', '#5E6B7A'];

const fmt = (n) => (Number(n) || 0).toLocaleString('en-IN');

function reducedMotion() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
}

/** true one frame after mount, so CSS transitions run from the start state */
function useEntered(dep) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(false);
    if (reducedMotion()) { setOn(true); return undefined; }
    let r2;
    const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setOn(true)); });
    return () => { cancelAnimationFrame(r1); if (r2) cancelAnimationFrame(r2); };
  }, [dep]);
  return on;
}

/** Number that counts up from 0 to `value` */
export function CountUp({ value, format = fmt, duration = 900 }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const target = Number(value) || 0;
    if (reducedMotion() || !target) { setShown(target); return undefined; }
    let raf;
    const start = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{format(shown)}</>;
}

function Tooltip({ tip }) {
  if (!tip) return null;
  return (
    <div className="sp-chart-tip" style={{ left: tip.x, top: tip.y }}>
      {tip.title && <div className="sp-chart-tip-title">{tip.title}</div>}
      {tip.rows.map(r => (
        <div key={r.label} className="sp-chart-tip-row">
          {r.color && <span className="sp-chart-dot" style={{ background: r.color }}></span>}
          <span>{r.label}</span><strong>{r.value}</strong>
        </div>
      ))}
    </div>
  );
}

export function Legend({ items }) {
  return (
    <div className="sp-chart-legend">
      {items.map(it => (
        <span key={it.label}><span className="sp-chart-dot" style={{ background: it.color }}></span>{it.label}{it.value !== undefined && <strong> {it.value}</strong>}</span>
      ))}
    </div>
  );
}

export function EmptyChart({ text = 'No data in this period yet.' }) {
  return <div className="sp-chart-empty"><i className="fa fa-bar-chart" aria-hidden="true"></i><span>{text}</span></div>;
}

/* ------------------------------------------------------------------ Donut and pie */
export function DonutChart({ data, size = 180, thickness = 26, pie = false, centerLabel = 'Total', format = fmt }) {
  const items = (data || []).filter(d => d.value > 0).map((d, i) => ({ ...d, color: d.color || PALETTE[i % PALETTE.length] }));
  const total = items.reduce((s, d) => s + d.value, 0);
  const on = useEntered(total + ':' + items.length);
  const [hover, setHover] = useState(null);
  if (!total) return <EmptyChart />;
  const stroke = pie ? size / 2 : thickness;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;
  const active = hover !== null ? items[hover] : null;
  return (
    <div className="sp-donut">
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={items.map(d => `${d.label} ${d.value}`).join(', ')}>
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {!pie && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F1EAE2" strokeWidth={stroke} />}
          {items.map((d, i) => {
            const len = (d.value / total) * c;
            const gap = items.length > 1 && !pie ? Math.min(2, len / 4) : 0;
            const el = (
              <circle key={d.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={d.color}
                strokeWidth={hover === i ? stroke + 6 : stroke}
                strokeDasharray={on ? `${Math.max(0, len - gap)} ${c - Math.max(0, len - gap)}` : `0 ${c}`}
                strokeDashoffset={-acc}
                style={{ transition: `stroke-dasharray 900ms cubic-bezier(.2,.8,.2,1) ${i * 90}ms, stroke-width 150ms`, cursor: 'pointer', opacity: hover !== null && hover !== i ? 0.55 : 1 }}
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <title>{`${d.label}: ${format(d.value)} (${Math.round((d.value / total) * 100)}%)`}</title>
              </circle>
            );
            acc += len;
            return el;
          })}
        </g>
        {!pie && (
          <g style={{ pointerEvents: 'none' }}>
            <text x={size / 2} y={size / 2 - 4} textAnchor="middle" className="sp-donut-value">{active ? format(active.value) : <CountUp value={total} format={format} />}</text>
            <text x={size / 2} y={size / 2 + 16} textAnchor="middle" className="sp-donut-label">{active ? `${active.label} · ${Math.round((active.value / total) * 100)}%` : centerLabel}</text>
          </g>
        )}
      </svg>
      <div className="sp-donut-legend">
        {items.map((d, i) => (
          <div key={d.label} className={`sp-donut-row ${hover === i ? 'is-active' : ''}`} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <span className="sp-chart-dot" style={{ background: d.color }}></span>
            <span className="sp-donut-name">{d.label}</span>
            <strong>{format(d.value)}</strong>
            <span className="sp-donut-pct">{Math.round((d.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Vertical bars */
export function BarChart({ labels, series, rows, stacked = false, height = 200, format = fmt, labelFormat = (l) => l }) {
  const wrap = useRef(null);
  const [tip, setTip] = useState(null);
  const totals = rows.map(r => series.reduce((s, se) => s + (Number(r[se.key]) || 0), 0));
  const max = Math.max(1, ...(stacked ? totals : rows.flatMap(r => series.map(se => Number(r[se.key]) || 0))));
  const on = useEntered(JSON.stringify(totals));
  if (!totals.some(t => t > 0)) return <EmptyChart />;
  const W = 640, H = height, L = 34, R = 8, T = 10, B = 26;
  const n = rows.length;
  const band = (W - L - R) / n;
  const barW = stacked ? Math.max(3, band * 0.62) : Math.max(2, (band * 0.7) / series.length);
  const y = (v) => T + (H - T - B) * (1 - v / max);
  const ticks = niceTicks(max);
  const every = Math.ceil(n / 10);

  function show(i, e) {
    const box = wrap.current.getBoundingClientRect();
    setTip({
      x: Math.min(e.clientX - box.left + 12, box.width - 160), y: e.clientY - box.top - 10,
      title: labelFormat(labels[i], true),
      rows: series.map(se => ({ label: se.label, value: format(rows[i][se.key] || 0), color: se.color }))
    });
  }

  return (
    <div className="sp-chart" ref={wrap} onMouseLeave={() => setTip(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="sp-chart-svg" role="img" aria-label={series.map(s => s.label).join(', ')}>
        {ticks.map(t => (
          <g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="sp-chart-gridline" /><text x={L - 6} y={y(t) + 4} textAnchor="end" className="sp-chart-axis">{format(t)}</text></g>
        ))}
        {rows.map((r, i) => {
          let base = 0;
          return (
            <g key={i} onMouseMove={(e) => show(i, e)}>
              <rect x={L + i * band} y={T} width={band} height={H - T - B} fill="transparent" />
              {series.map((se, j) => {
                const v = Number(r[se.key]) || 0;
                const x = stacked ? L + i * band + (band - barW) / 2 : L + i * band + (band - barW * series.length) / 2 + j * barW;
                const top = stacked ? y(base + v) : y(v);
                const h = stacked ? y(base) - y(base + v) : (H - B) - y(v);
                if (stacked) base += v;
                if (!v) return null;
                return (
                  <rect key={se.key} x={x} y={top} width={barW - (stacked ? 0 : 1)} height={Math.max(0, h)} rx={stacked ? 2 : 2} fill={se.color}
                    style={{ transformOrigin: `0 ${H - B}px`, transform: on ? 'scaleY(1)' : 'scaleY(0)', transition: `transform 700ms cubic-bezier(.2,.8,.2,1) ${Math.min(i * 18, 500)}ms` }} />
                );
              })}
              {(i % every === 0 || i === n - 1) && <text x={L + i * band + band / 2} y={H - 8} textAnchor="middle" className="sp-chart-axis">{labelFormat(labels[i])}</text>}
            </g>
          );
        })}
      </svg>
      {series.length > 1 && <Legend items={series.map(s => ({ label: s.label, color: s.color }))} />}
      <Tooltip tip={tip} />
    </div>
  );
}

/* ------------------------------------------------------------------ Horizontal bars */
export function HBarChart({ items, color = PALETTE[0], format = fmt, max: maxIn }) {
  const list = (items || []).filter(i => i.count > 0);
  const max = maxIn || Math.max(1, ...list.map(i => i.count));
  const on = useEntered(list.map(i => i.name + i.count).join('|'));
  if (!list.length) return <EmptyChart />;
  return (
    <div className="sp-hbars">
      {list.map((it, i) => (
        <div key={it.name} className="sp-hbar" title={`${it.name}: ${format(it.count)}`}>
          <div className="sp-hbar-label"><span>{it.name}</span><strong>{format(it.count)}</strong></div>
          <div className="sp-hbar-track">
            <div className="sp-hbar-fill" style={{ width: on ? `${(it.count / max) * 100}%` : '0%', background: it.color || (Array.isArray(color) ? color[i % color.length] : color), transitionDelay: `${i * 70}ms` }}></div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ Line and area */
export function LineChart({ labels, series, rows, height = 220, area = true, stacked = false, format = fmt, labelFormat = (l) => l }) {
  const wrap = useRef(null);
  const paths = useRef([]);
  const [lens, setLens] = useState([]);
  const [hoverI, setHoverI] = useState(null);
  const [tip, setTip] = useState(null);
  const sums = rows.map(r => series.reduce((s, se) => s + (Number(r[se.key]) || 0), 0));
  const max = Math.max(1, ...(stacked ? sums : rows.flatMap(r => series.map(se => Number(r[se.key]) || 0))));
  const sig = JSON.stringify(sums) + series.map(s => s.key).join();
  const on = useEntered(sig);
  useLayoutEffect(() => { setLens(paths.current.map(p => (p ? p.getTotalLength() : 0))); }, [sig]);
  const W = 640, H = height, L = 38, R = 10, T = 12, B = 26;
  const n = rows.length;
  const x = (i) => L + (n === 1 ? 0 : (i * (W - L - R)) / (n - 1));
  const y = (v) => T + (H - T - B) * (1 - v / max);
  const ticks = niceTicks(max);
  const every = Math.ceil(n / 10);
  const lines = useMemo(() => {
    const base = rows.map(() => 0);
    return series.map(se => {
      const pts = rows.map((r, i) => {
        const v = Number(r[se.key]) || 0;
        const lo = stacked ? base[i] : 0;
        const hi = lo + v;
        if (stacked) base[i] = hi;
        return { x: x(i), y: y(hi), y0: y(lo) };
      });
      const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
      const back = [...pts].reverse().map(p => `L${p.x.toFixed(1)},${p.y0.toFixed(1)}`).join(' ');
      return { ...se, pts, d, areaD: `${d} ${back} Z` };
    });
  }, [sig, max]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!sums.some(s => s > 0)) return <EmptyChart />;

  function move(e) {
    const box = wrap.current.getBoundingClientRect();
    const sx = ((e.clientX - box.left) / box.width) * W;
    const i = Math.max(0, Math.min(n - 1, Math.round(((sx - L) / (W - L - R)) * (n - 1))));
    setHoverI(i);
    setTip({
      x: Math.min(e.clientX - box.left + 12, box.width - 170), y: e.clientY - box.top - 10,
      title: labelFormat(labels[i], true),
      rows: series.map(se => ({ label: se.label, value: format(rows[i][se.key] || 0), color: se.color }))
    });
  }

  return (
    <div className="sp-chart" ref={wrap} onMouseMove={move} onMouseLeave={() => { setTip(null); setHoverI(null); }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="sp-chart-svg" role="img" aria-label={series.map(s => s.label).join(', ')}>
        <defs>
          {lines.map(l => (
            <linearGradient key={l.key} id={`grad-${l.key}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={l.color} stopOpacity="0.32" />
              <stop offset="100%" stopColor={l.color} stopOpacity="0.02" />
            </linearGradient>
          ))}
        </defs>
        {ticks.map(t => (
          <g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="sp-chart-gridline" /><text x={L - 6} y={y(t) + 4} textAnchor="end" className="sp-chart-axis">{format(t)}</text></g>
        ))}
        {labels.map((lb, i) => (i % every === 0 || i === n - 1) && <text key={lb} x={x(i)} y={H - 8} textAnchor="middle" className="sp-chart-axis">{labelFormat(lb)}</text>)}
        {area && lines.map(l => (
          <path key={`a-${l.key}`} d={l.areaD} fill={`url(#grad-${l.key})`} style={{ opacity: on ? 1 : 0, transition: 'opacity 900ms ease 300ms' }} />
        ))}
        {lines.map((l, k) => (
          <path key={l.key} ref={el => { paths.current[k] = el; }} d={l.d} fill="none" stroke={l.color} strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round"
            strokeDasharray={lens[k] || 1} strokeDashoffset={on && lens[k] ? 0 : (lens[k] || 1)}
            style={{ transition: lens[k] ? `stroke-dashoffset 1200ms cubic-bezier(.4,0,.2,1) ${k * 150}ms` : 'none' }} />
        ))}
        {hoverI !== null && (
          <g style={{ pointerEvents: 'none' }}>
            <line x1={x(hoverI)} x2={x(hoverI)} y1={T} y2={H - B} className="sp-chart-guide" />
            {lines.map(l => <circle key={l.key} cx={l.pts[hoverI].x} cy={l.pts[hoverI].y} r="4" fill="#fff" stroke={l.color} strokeWidth="2" />)}
          </g>
        )}
      </svg>
      {series.length > 1 && <Legend items={series.map(s => ({ label: s.label, color: s.color }))} />}
      <Tooltip tip={tip} />
    </div>
  );
}

/* ------------------------------------------------------------------ Gauge */
export function Gauge({ value, label, color = PALETTE[2], suffix = '%', empty = 'Not enough data yet' }) {
  const on = useEntered(value);
  if (value === null || value === undefined) return <EmptyChart text={empty} />;
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  const R = 70, C = Math.PI * R;
  const tone = color === 'auto' ? (v >= 75 ? '#2E7D32' : v >= 50 ? '#C5A059' : '#C62828') : color;
  return (
    <div className="sp-gauge">
      <svg viewBox="0 0 180 104" width="180" height="104" role="img" aria-label={`${label}: ${v}${suffix}`}>
        <path d={`M20 92 A${R} ${R} 0 0 1 160 92`} fill="none" stroke="#F1EAE2" strokeWidth="16" strokeLinecap="round" />
        <path d={`M20 92 A${R} ${R} 0 0 1 160 92`} fill="none" stroke={tone} strokeWidth="16" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={on ? C * (1 - v / 100) : C} style={{ transition: 'stroke-dashoffset 1100ms cubic-bezier(.2,.8,.2,1)' }} />
        <text x="90" y="82" textAnchor="middle" className="sp-gauge-value"><CountUp value={v} />{suffix}</text>
      </svg>
      <div className="sp-gauge-label">{label}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ Funnel */
export function Funnel({ steps, colors = PALETTE }) {
  const first = steps && steps[0] ? steps[0].value : 0;
  const on = useEntered(steps.map(s => s.value).join());
  if (!first) return <EmptyChart text="No new accounts in this period yet." />;
  return (
    <div className="sp-funnel">
      {steps.map((s, i) => {
        const pct = Math.round((s.value / first) * 100);
        const prev = i ? steps[i - 1].value : null;
        return (
          <div key={s.label} className="sp-funnel-step">
            <div className="sp-funnel-bar-wrap">
              <div className="sp-funnel-bar" style={{ width: on ? `${Math.max(6, pct)}%` : '0%', background: colors[i % colors.length], transitionDelay: `${i * 140}ms` }}>
                <span><CountUp value={s.value} /></span>
              </div>
            </div>
            <div className="sp-funnel-label">
              <strong>{s.label}</strong>
              <small>{i === 0 ? '100%' : `${pct}% of start${prev ? ` · ${Math.round((s.value / prev) * 100)}% of previous step` : ''}`}</small>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ Sparkline */
export function Sparkline({ values, color = PALETTE[0], width = 110, height = 34 }) {
  const on = useEntered((values || []).join());
  const vals = values || [];
  if (vals.length < 2) return null;
  const max = Math.max(1, ...vals);
  const pts = vals.map((v, i) => [(i * width) / (vals.length - 1), height - 3 - ((height - 6) * v) / max]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="sp-spark" aria-hidden="true">
      <path d={`${d} L${width},${height} L0,${height} Z`} fill={color} opacity={on ? 0.12 : 0} style={{ transition: 'opacity 800ms ease' }} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" vectorEffect="non-scaling-stroke" pathLength="1" strokeDasharray="1" strokeDashoffset={on ? 0 : 1} style={{ transition: 'stroke-dashoffset 1100ms ease' }} />
    </svg>
  );
}

function niceTicks(max) {
  if (max <= 4) return Array.from({ length: Math.ceil(max) + 1 }, (_, i) => i);
  const raw = max / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) || raw;
  const out = [];
  for (let v = 0; v <= max + 1e-9; v += step) out.push(Math.round(v));
  return out;
}
