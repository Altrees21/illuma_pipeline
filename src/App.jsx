import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from './supabase.js'

// ── Constants ──────────────────────────────────────────────────────────────
const TEAM      = ['Alby', 'Dan', 'Alyssa', 'Logan']
const STAGES    = ['Prospecting', 'Qualified', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost']
const VERTICALS = ['Agency / Trading Desk', 'Pharma', 'Political', 'Brand Direct', 'Other']
const USER_KEY  = 'illuma-user'

const SM = {
  'Prospecting': { dot: '#94A3B8', bg: '#F1F5F9', text: '#475569' },
  'Qualified':   { dot: '#22C55E', bg: '#F0FDF4', text: '#166534' },
  'Proposal':    { dot: '#F59E0B', bg: '#FFFBEB', text: '#92400E' },
  'Negotiation': { dot: '#F97316', bg: '#FFF7ED', text: '#7C2D12' },
  'Closed Won':  { dot: '#10B981', bg: '#D1FAE5', text: '#064E3B' },
  'Closed Lost': { dot: '#F43F5E', bg: '#FFF1F2', text: '#881337' },
}
const OC = { Alby: '#6366F1', Dan: '#0EA5E9', Alyssa: '#EC4899', Logan: '#14B8A6' }

// ── Helpers ────────────────────────────────────────────────────────────────
const money   = (n) => '$' + Math.round(Number(n) || 0).toLocaleString()
const fmtDate = (d) => d ? new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : '—'
const fmtTS   = (t) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
const uid     = () => crypto.randomUUID()
const ini     = (n) => (n || '?').slice(0, 2).toUpperCase()

// ── Blank deal template ────────────────────────────────────────────────────
const BLANK = { company: '', contact: '', vertical: 'Agency / Trading Desk', stage: 'Prospecting', value: '', close_date: '', notes: '', owner: 'Alby' }

// ── Styles ─────────────────────────────────────────────────────────────────
const css = `
  * { box-sizing: border-box; }
  .rh { transition: background 0.1s; }
  .rh:hover { background: #EDEBE6 !important; cursor: pointer; }
  .btn { padding: 5px 12px; border-radius: 7px; font-size: 12px; cursor: pointer; border: 1px solid #D4D0C8; background: transparent; color: #1A1A1A; font-family: inherit; transition: background 0.1s; }
  .btn:hover { background: #EDEBE6; }
  .btn.p { background: #1A1A1A; color: #F8F7F4; border: none; font-weight: 500; }
  .btn.p:hover { background: #333; }
  .btn:disabled { opacity: 0.45; cursor: default; }
  .inp { width: 100%; padding: 7px 10px; border: 1px solid #D4D0C8; border-radius: 7px; font-size: 13px; background: #fff; color: #1A1A1A; font-family: inherit; }
  .inp:focus { outline: none; border-color: #999; }
  select.inp { appearance: auto; }
  .card-hover { border: 1px solid #E2DED5; border-radius: 8px; background: #fff; transition: border-color 0.1s; cursor: pointer; }
  .card-hover:hover { border-color: #999; }
  label.fl { font-size: 10px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.07em; color: #888; display: block; margin-bottom: 4px; }
  .tag { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 500; white-space: nowrap; }
  .spin { display: inline-block; width: 14px; height: 14px; border: 2px solid #ddd; border-top-color: #555; border-radius: 50%; animation: spin 0.7s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
`

// ── Component ──────────────────────────────────────────────────────────────
export default function App() {
  const [deals,    setDeals]    = useState([])
  const [acts,     setActs]     = useState([])
  const [user,     setUser]     = useState(() => localStorage.getItem(USER_KEY))
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const [sel,      setSel]      = useState(null)   // deal id | 'new' | null
  const [form,     setForm]     = useState(null)
  const [comment,  setComment]  = useState('')
  const [view,     setView]     = useState('list')
  const [saving,   setSaving]   = useState(false)
  const [fStage,   setFStage]   = useState('All')
  const [fOwner,   setFOwner]   = useState('All')
  const [fVert,    setFVert]    = useState('All')
  const [fQ,       setFQ]       = useState('')
  const [sortBy,   setSortBy]   = useState('close_date')

  // ── Load data ──────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    try {
      const [{ data: d, error: de }, { data: a, error: ae }] = await Promise.all([
        supabase.from('deals').select('*').order('created_at', { ascending: false }),
        supabase.from('activity').select('*').order('created_at', { ascending: false }),
      ])
      if (de) throw de
      if (ae) throw ae
      setDeals(d || [])
      setActs(a || [])
      setError(null)
    } catch (e) {
      setError(e.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAll()

    // Real-time subscriptions — any change by any team member reflects instantly
    const dealSub = supabase
      .channel('deals-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deals' }, loadAll)
      .subscribe()

    const actSub = supabase
      .channel('activity-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity' }, loadAll)
      .subscribe()

    return () => {
      supabase.removeChannel(dealSub)
      supabase.removeChannel(actSub)
    }
  }, [loadAll])

  // ── Choose user ────────────────────────────────────────────────
  const chooseUser = (name) => {
    localStorage.setItem(USER_KEY, name)
    setUser(name)
    if (form) setForm(f => ({ ...f }))
  }

  // ── Log activity ───────────────────────────────────────────────
  const log = async (dealId, type, text) => {
    await supabase.from('activity').insert({ id: uid(), deal_id: dealId, user: user || '?', type, text, created_at: new Date().toISOString() })
  }

  // ── Panel open/close ───────────────────────────────────────────
  const openNew = () => {
    setForm({ ...BLANK, owner: user || 'Alby' })
    setSel('new')
    setComment('')
  }
  const openDeal = (deal) => {
    setForm({ ...deal })
    setSel(deal.id)
    setComment('')
  }
  const closePanel = () => { setSel(null); setForm(null); setComment('') }

  // ── Save deal ──────────────────────────────────────────────────
  const save = async () => {
    if (!form?.company?.trim()) return
    setSaving(true)
    try {
      const payload = { ...form, value: Number(form.value) || 0, updated_at: new Date().toISOString() }

      if (sel === 'new') {
        payload.id = uid()
        payload.created_at = new Date().toISOString()
        const { error: e } = await supabase.from('deals').insert(payload)
        if (e) throw e
        await log(payload.id, 'created', 'created this deal')
        setSel(payload.id)
        setForm(payload)
      } else {
        const old = deals.find(d => d.id === sel)
        const { error: e } = await supabase.from('deals').update(payload).eq('id', sel)
        if (e) throw e
        if (old.stage !== payload.stage) await log(sel, 'stage',  `moved to ${payload.stage}`)
        if (old.owner !== payload.owner) await log(sel, 'assign', `assigned to ${payload.owner}`)
        if (Number(old.value) !== Number(payload.value)) await log(sel, 'value', `updated value: ${money(old.value)} → ${money(payload.value)}`)
      }
    } catch (e) {
      alert('Save failed: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Delete deal ────────────────────────────────────────────────
  const deleteDeal = async () => {
    if (!confirm(`Delete ${form?.company}? This cannot be undone.`)) return
    await supabase.from('deals').delete().eq('id', sel)
    closePanel()
  }

  // ── Post comment ───────────────────────────────────────────────
  const postComment = async () => {
    if (!comment.trim() || !sel || sel === 'new') return
    await log(sel, 'comment', comment.trim())
    setComment('')
  }

  // ── CSV export ─────────────────────────────────────────────────
  const exportCSV = () => {
    const hdr  = ['Company', 'Contact', 'Vertical', 'Stage', 'Owner', 'Value', 'Close Date', 'Notes']
    const rows = deals.map(d =>
      [d.company, d.contact, d.vertical, d.stage, d.owner, d.value, d.close_date, d.notes]
        .map(v => `"${(v || '').toString().replace(/"/g, '""')}"`)
        .join(',')
    )
    const blob = new Blob([[hdr.join(','), ...rows].join('\n')], { type: 'text/csv' })
    Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'illuma-pipeline.csv' }).click()
  }

  // ── Derived data ───────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...deals]
    if (fStage !== 'All') list = list.filter(d => d.stage === fStage)
    if (fOwner !== 'All') list = list.filter(d => d.owner === fOwner)
    if (fVert  !== 'All') list = list.filter(d => d.vertical === fVert)
    if (fQ.trim()) {
      const q = fQ.toLowerCase()
      list = list.filter(d => (d.company || '').toLowerCase().includes(q) || (d.contact || '').toLowerCase().includes(q))
    }
    list.sort((a, b) => {
      if (sortBy === 'value')   return Number(b.value) - Number(a.value)
      if (sortBy === 'company') return (a.company || '').localeCompare(b.company || '')
      return new Date(a.close_date || '9999') - new Date(b.close_date || '9999')
    })
    return list
  }, [deals, fStage, fOwner, fVert, fQ, sortBy])

  const metrics = useMemo(() => {
    const active = deals.filter(d => !['Closed Won', 'Closed Lost'].includes(d.stage))
    const won    = deals.filter(d => d.stage === 'Closed Won')
    const closed = deals.filter(d => ['Closed Won', 'Closed Lost'].includes(d.stage))
    return {
      pipe: active.reduce((s, d) => s + Number(d.value || 0), 0),
      won:  won.reduce((s, d)    => s + Number(d.value || 0), 0),
      wr:   closed.length ? Math.round(won.length / closed.length * 100) : 0,
      cnt:  active.length,
    }
  }, [deals])

  const dealActs = useMemo(() =>
    acts.filter(a => a.deal_id === sel).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  , [acts, sel])

  // ── Sub-components ─────────────────────────────────────────────
  const Avatar = ({ name, size = 24 }) => (
    <div style={{ width: size, height: size, borderRadius: '50%', background: OC[name] || '#888', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.round(size * 0.38), fontWeight: 500, color: 'white', flexShrink: 0, userSelect: 'none' }}>
      {ini(name)}
    </div>
  )

  const Pill = ({ stage }) => {
    const m = SM[stage] || {}
    return (
      <span className="tag" style={{ background: m.bg, color: m.text }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: m.dot, display: 'inline-block', flexShrink: 0 }} />
        {stage}
      </span>
    )
  }

  const panelOpen = !!(sel && form)

  // ── User picker ────────────────────────────────────────────────
  if (!user) return (
    <div style={{ minHeight: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
      <style>{css}</style>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 500, marginBottom: 4 }}>Illuma Pipeline</div>
        <div style={{ fontSize: 14, color: '#888' }}>Who are you?</div>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        {TEAM.map(name => (
          <button key={name} onClick={() => chooseUser(name)}
            style={{ padding: '12px 24px', borderRadius: 10, border: '1px solid #D4D0C8', background: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 500, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8, transition: 'background 0.1s' }}
            onMouseEnter={e => e.currentTarget.style.background = '#F0EEE9'}
            onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: OC[name], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 500, color: 'white' }}>{ini(name)}</div>
            {name}
          </button>
        ))}
      </div>
    </div>
  )

  // ── Loading / error ────────────────────────────────────────────
  if (loading) return (
    <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: '#888' }}>
      <style>{css}</style>
      <div className="spin" /> Loading pipeline…
    </div>
  )

  if (error) return (
    <div style={{ height: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: '#888' }}>
      <style>{css}</style>
      <div style={{ fontWeight: 500, color: '#E24B4A' }}>Connection error</div>
      <div style={{ fontSize: 13 }}>{error}</div>
      <button className="btn p" onClick={loadAll}>Retry</button>
    </div>
  )

  // ── Main app ───────────────────────────────────────────────────
  return (
    <div>
      <style>{css}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 500 }}>Illuma Pipeline</div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{metrics.cnt} active opportunities · live sync on</div>
        </div>
        <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn" onClick={exportCSV} style={{ fontSize: 11 }}>Export CSV</button>
          <button className="btn p" onClick={openNew}>+ New deal</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 10px 3px 6px', border: '1px solid #D4D0C8', borderRadius: 20, background: '#fff' }}>
            <Avatar name={user} size={22} />
            <select value={user} onChange={e => chooseUser(e.target.value)}
              style={{ border: 'none', background: 'transparent', fontSize: 12, fontWeight: 500, cursor: 'pointer', outline: 'none', fontFamily: 'inherit', color: '#1A1A1A' }}>
              {TEAM.map(n => <option key={n}>{n}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
        {[
          { label: 'Active pipeline', val: money(metrics.pipe) },
          { label: 'Closed won',      val: money(metrics.won),  green: true },
          { label: 'Win rate',        val: `${metrics.wr}%` },
        ].map(({ label, val, green }) => (
          <div key={label} style={{ background: '#EDEBE6', borderRadius: 8, padding: '10px 14px' }}>
            <div style={{ fontSize: 10, color: '#888', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 500, fontFamily: "'DM Mono', monospace", color: green ? '#059669' : '#1A1A1A' }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 7, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input  className="inp" placeholder="Search…" value={fQ} onChange={e => setFQ(e.target.value)} style={{ width: 130 }} />
        <select className="inp" value={fStage} onChange={e => setFStage(e.target.value)} style={{ width: 140 }}>
          <option value="All">All stages</option>
          {STAGES.map(s => <option key={s}>{s}</option>)}
        </select>
        <select className="inp" value={fOwner} onChange={e => setFOwner(e.target.value)} style={{ width: 110 }}>
          <option value="All">All reps</option>
          {TEAM.map(t => <option key={t}>{t}</option>)}
        </select>
        <select className="inp" value={fVert} onChange={e => setFVert(e.target.value)} style={{ width: 165 }}>
          <option value="All">All verticals</option>
          {VERTICALS.map(v => <option key={v}>{v}</option>)}
        </select>
        <select className="inp" value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ width: 148 }}>
          <option value="close_date">Sort: close date</option>
          <option value="value">Sort: value</option>
          <option value="company">Sort: A–Z</option>
        </select>
        <div style={{ marginLeft: 'auto', display: 'flex', background: '#EDEBE6', borderRadius: 7, padding: 2 }}>
          {['list', 'board'].map(v => (
            <button key={v} onClick={() => setView(v)}
              style={{ padding: '3px 14px', borderRadius: 5, border: 'none', background: view === v ? '#fff' : 'transparent', cursor: 'pointer', fontSize: 12, fontWeight: view === v ? 500 : 400, fontFamily: 'inherit', color: '#1A1A1A', boxShadow: view === v ? '0 0 0 1px #D4D0C8' : 'none' }}>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Main content — split layout when panel open */}
      <div style={{ display: 'grid', gridTemplateColumns: panelOpen ? 'minmax(0,1fr) 350px' : 'minmax(0,1fr)', gap: 12, alignItems: 'start' }}>

        {/* LIST VIEW */}
        {view === 'list' && (
          <div style={{ border: '1px solid #E2DED5', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr style={{ background: '#F3F1EC', fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  <th style={{ padding: '9px 13px', textAlign: 'left', width: panelOpen ? '32%' : '22%', fontWeight: 500 }}>Company</th>
                  {!panelOpen && <th style={{ padding: '9px 13px', textAlign: 'left', width: '15%', fontWeight: 500 }}>Vertical</th>}
                  <th style={{ padding: '9px 13px', textAlign: 'left', width: '21%', fontWeight: 500 }}>Stage</th>
                  <th style={{ padding: '9px 13px', textAlign: 'left', width: '13%', fontWeight: 500 }}>Owner</th>
                  <th style={{ padding: '9px 13px', textAlign: 'right', width: '13%', fontWeight: 500 }}>Value</th>
                  {!panelOpen && <th style={{ padding: '9px 13px', textAlign: 'right', fontWeight: 500 }}>Close</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((deal, i) => (
                  <tr key={deal.id} className="rh" onClick={() => openDeal(deal)}
                    style={{ borderTop: i > 0 ? '1px solid #F0EDE6' : 'none', background: sel === deal.id ? '#F3F1EC' : 'transparent' }}>
                    <td style={{ padding: '10px 13px' }}>
                      <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{deal.company}</div>
                      <div style={{ fontSize: 11, color: '#888' }}>{deal.contact}</div>
                    </td>
                    {!panelOpen && <td style={{ padding: '10px 13px', fontSize: 11, color: '#888' }}>{deal.vertical}</td>}
                    <td style={{ padding: '10px 13px' }}><Pill stage={deal.stage} /></td>
                    <td style={{ padding: '10px 13px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Avatar name={deal.owner} size={20} />
                        {!panelOpen && <span style={{ fontSize: 11 }}>{deal.owner}</span>}
                      </div>
                    </td>
                    <td style={{ padding: '10px 13px', textAlign: 'right', fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 500 }}>{money(deal.value)}</td>
                    {!panelOpen && <td style={{ padding: '10px 13px', textAlign: 'right', fontSize: 11, color: '#888' }}>{fmtDate(deal.close_date)}</td>}
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: '#aaa', fontSize: 13 }}>No results</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* BOARD VIEW */}
        {view === 'board' && (
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6 }}>
            {STAGES.map(stage => {
              const cd  = deals.filter(d => d.stage === stage)
              const tot = cd.reduce((s, d) => s + Number(d.value || 0), 0)
              const m   = SM[stage]
              return (
                <div key={stage} style={{ background: '#EDEBE6', borderRadius: 10, padding: 10, flex: '0 0 172px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: m.dot, display: 'inline-block' }} />
                      <span style={{ fontSize: 10, fontWeight: 500 }}>{stage}</span>
                      <span style={{ fontSize: 9, color: '#888', background: '#fff', border: '1px solid #E2DED5', borderRadius: 10, padding: '1px 5px' }}>{cd.length}</span>
                    </div>
                    <span style={{ fontSize: 9, color: '#888', fontFamily: "'DM Mono', monospace" }}>{money(tot)}</span>
                  </div>
                  {cd.map(deal => (
                    <div key={deal.id} className="card-hover" onClick={() => openDeal(deal)}
                      style={{ padding: '8px 9px', marginBottom: 6, borderColor: sel === deal.id ? '#999' : '#E2DED5' }}>
                      <div style={{ fontSize: 11, fontWeight: 500, marginBottom: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{deal.company}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Avatar name={deal.owner} size={18} />
                        <span style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", fontWeight: 500 }}>{money(deal.value)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        )}

        {/* DEAL PANEL */}
        {panelOpen && (
          <div style={{ border: '1px solid #D4D0C8', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>

            {/* Panel header */}
            <div style={{ padding: '10px 14px', borderBottom: '1px solid #E2DED5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F3F1EC' }}>
              <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 6 }}>
                {sel === 'new' ? 'New opportunity' : (form.company || 'Untitled')}
              </div>
              <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                {sel !== 'new' && (
                  <button className="btn" onClick={deleteDeal} style={{ fontSize: 11, color: '#DC2626', borderColor: '#FCA5A5' }}>Delete</button>
                )}
                <button className="btn" onClick={closePanel} style={{ fontSize: 11 }}>✕</button>
                <button className="btn p" onClick={save} disabled={saving} style={{ fontSize: 11 }}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>

            {/* Panel body */}
            <div style={{ overflowY: 'auto', maxHeight: 700 }}>
              <div style={{ padding: '14px 14px 0' }}>

                {/* Text fields */}
                {[
                  { label: 'Company', key: 'company', placeholder: 'Acme Agency' },
                  { label: 'Contact', key: 'contact', placeholder: 'Jane Smith' },
                ].map(({ label, key, placeholder }) => (
                  <div key={key} style={{ marginBottom: 12 }}>
                    <label className="fl">{label}</label>
                    <input className="inp" placeholder={placeholder} value={form[key] || ''} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
                  </div>
                ))}

                {/* Grid fields */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  {[
                    { label: 'Vertical', key: 'vertical', opts: VERTICALS },
                    { label: 'Stage',    key: 'stage',    opts: STAGES },
                    { label: 'Owner',    key: 'owner',    opts: TEAM },
                  ].map(({ label, key, opts }) => (
                    <div key={key}>
                      <label className="fl">{label}</label>
                      <select className="inp" value={form[key] || ''} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}>
                        {opts.map(o => <option key={o}>{o}</option>)}
                      </select>
                    </div>
                  ))}
                  <div>
                    <label className="fl">Value ($)</label>
                    <input className="inp" type="number" placeholder="50000" value={form.value || ''} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label className="fl">Close date</label>
                    <input className="inp" type="date" value={form.close_date || ''} onChange={e => setForm(f => ({ ...f, close_date: e.target.value }))} />
                  </div>
                </div>

                {/* Notes */}
                <div style={{ marginBottom: 14 }}>
                  <label className="fl">Notes</label>
                  <textarea className="inp" rows={3} style={{ resize: 'vertical' }} value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>

              {/* Activity feed */}
              {sel !== 'new' && (
                <div style={{ borderTop: '1px solid #E2DED5', padding: '12px 14px 16px' }}>
                  <div style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#888', marginBottom: 12 }}>Activity</div>

                  {/* Comment box */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'flex-start' }}>
                    <Avatar name={user} size={26} />
                    <div style={{ flex: 1 }}>
                      <textarea className="inp" rows={2} placeholder="Add a note or update…" value={comment}
                        onChange={e => setComment(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); postComment() } }}
                        style={{ resize: 'none', marginBottom: 6 }} />
                      <button className="btn p" onClick={postComment} style={{ fontSize: 11 }}>Post</button>
                    </div>
                  </div>

                  {/* Activity entries */}
                  {dealActs.length === 0 ? (
                    <div style={{ fontSize: 12, color: '#aaa', textAlign: 'center', padding: '8px 0' }}>No activity yet.</div>
                  ) : dealActs.map(entry => (
                    <div key={entry.id} style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                      <Avatar name={entry.user} size={24} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {entry.type === 'comment' ? (
                          <>
                            <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>
                              <span style={{ fontWeight: 500, color: '#1A1A1A' }}>{entry.user}</span> commented
                            </div>
                            <div style={{ fontSize: 12, background: '#F3F1EC', borderRadius: 6, padding: '6px 9px' }}>{entry.text}</div>
                          </>
                        ) : (
                          <div style={{ fontSize: 11, color: '#888' }}>
                            <span style={{ fontWeight: 500, color: '#1A1A1A' }}>{entry.user}</span> {entry.text}
                          </div>
                        )}
                        <div style={{ fontSize: 10, color: '#aaa', marginTop: 3 }}>{fmtTS(entry.created_at)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
