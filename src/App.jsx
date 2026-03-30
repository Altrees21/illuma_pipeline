import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from './supabase.js'

const TEAM        = ['Alby', 'Dan', 'Alyssa', 'Logan']
const STAGES      = ['Prospecting', 'Qualified', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost']
const VERTICALS   = ['Agency / Trading Desk', 'Pharma', 'Political', 'Brand Direct', 'CPG', 'Tech', 'Finance', 'Travel', 'Entertainment', 'Other']
const DSPS        = ['TTD', 'DV360', 'Xandr', 'Amazon DSP', 'Yahoo DSP', 'Basis', 'Other']
const SSPS        = ['PubMatic', 'TTD Direct', 'Magnite', 'Index Exchange', 'OpenX', 'Other']
const MEDIA_TYPES = ['Display', 'OLV', 'CTV', 'Native', 'Audio', 'DOOH', 'Other']
const USER_KEY    = 'illuma-user'
const AUTH_KEY    = 'illuma-auth'
const PASSWORD    = import.meta.env.VITE_APP_PASSWORD || 'illuma2026'

const SM = {
  'Prospecting': { dot: '#94A3B8', bg: '#F1F5F9', text: '#475569' },
  'Qualified':   { dot: '#22C55E', bg: '#F0FDF4', text: '#166534' },
  'Proposal':    { dot: '#F59E0B', bg: '#FFFBEB', text: '#92400E' },
  'Negotiation': { dot: '#F97316', bg: '#FFF7ED', text: '#7C2D12' },
  'Closed Won':  { dot: '#10B981', bg: '#D1FAE5', text: '#064E3B' },
  'Closed Lost': { dot: '#F43F5E', bg: '#FFF1F2', text: '#881337' },
}
const OC = { Alby: '#6366F1', Dan: '#0EA5E9', Alyssa: '#EC4899', Logan: '#14B8A6' }

// These must live OUTSIDE App — if defined inside, React remounts them on every
// keystroke which kills input focus.
const Avatar = ({name, size=24}) => (
  <div style={{width:size,height:size,borderRadius:'50%',background:OC[name]||'#888',display:'flex',alignItems:'center',justifyContent:'center',fontSize:Math.round(size*.38),fontWeight:500,color:'white',flexShrink:0,userSelect:'none'}}>
    {(name||'?').slice(0,2).toUpperCase()}
  </div>
)
const Pill = ({stage}) => {
  const m = SM[stage]||{}
  return <span className="tag" style={{background:m.bg,color:m.text}}><span style={{width:5,height:5,borderRadius:'50%',background:m.dot,display:'inline-block',flexShrink:0}}/>{stage}</span>
}
const F = ({label, children, span}) => (
  <div style={{gridColumn:span?'1 / -1':undefined}}>
    <label className="fl">{label}</label>{children}
  </div>
)

const money   = (n) => '$' + Math.round(Number(n) || 0).toLocaleString()
const fmtDate = (d) => d ? new Date(d+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'2-digit'}) : '—'
const fmtTS   = (t) => new Date(t).toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})
const uid     = () => crypto.randomUUID()
const ini     = (n) => (n||'?').slice(0,2).toUpperCase()

const BLANK = {
  company:'', brand:'', campaign:'', contact:'',
  vertical:'Agency / Trading Desk', stage:'Prospecting',
  status:'', dsp:'', ssp:'', product:'', media_type:'', kpis:'',
  value:'', close_date:'', flight_start:'', flight_end:'',
  owner:'Alby', sales_owner:'', macro:'', last_outreach:'', notes:'',
}

const css = `
  * { box-sizing: border-box; }
  .rh { transition: background 0.1s; }
  .rh:hover { background: #EDEBE6 !important; cursor: pointer; }
  .btn { padding: 5px 12px; border-radius: 7px; font-size: 12px; cursor: pointer; border: 1px solid #D4D0C8; background: transparent; color: #1A1A1A; font-family: inherit; transition: background 0.1s; }
  .btn:hover { background: #EDEBE6; }
  .btn.p { background: #1A1A1A; color: #F8F7F4; border: none; font-weight: 500; }
  .btn.p:hover { background: #333; }
  .btn:disabled { opacity: 0.45; cursor: default; }
  .inp { width: 100%; padding: 7px 10px; border: 1px solid #D4D0C8; border-radius: 7px; font-size: 12px; background: #fff; color: #1A1A1A; font-family: inherit; }
  .inp:focus { outline: none; border-color: #999; }
  select.inp { appearance: auto; }
  .card-hover { border: 1px solid #E2DED5; border-radius: 8px; background: #fff; transition: border-color 0.1s; cursor: pointer; }
  .card-hover:hover { border-color: #999; }
  label.fl { font-size: 10px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.07em; color: #888; display: block; margin-bottom: 4px; }
  .tag { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 500; white-space: nowrap; }
  .spin { display: inline-block; width: 14px; height: 14px; border: 2px solid #ddd; border-top-color: #555; border-radius: 50%; animation: spin 0.7s linear infinite; }
  .sec { font-size: 9px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.1em; color: #bbb; padding: 10px 0 8px; border-top: 1px solid #F0EDE6; margin-top: 6px; }
  @keyframes spin { to { transform: rotate(360deg); } }
`

export default function App() {
  const [deals,   setDeals]   = useState([])
  const [acts,    setActs]    = useState([])
  const [authed,  setAuthed]  = useState(() => localStorage.getItem(AUTH_KEY) === PASSWORD)
  const [pwInput, setPwInput] = useState('')
  const [pwError, setPwError] = useState(false)
  const [user,    setUser]    = useState(() => localStorage.getItem(USER_KEY))
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [sel,     setSel]     = useState(null)
  const [form,    setForm]    = useState(null)
  const [comment, setComment] = useState('')
  const [view,    setView]    = useState('list')
  const [saving,  setSaving]  = useState(false)
  const [fStage,  setFStage]  = useState('All')
  const [fOwner,  setFOwner]  = useState('All')
  const [fVert,   setFVert]   = useState('All')
  const [fQ,      setFQ]      = useState('')
  const [sortBy,  setSortBy]  = useState('close_date')
  const [tab,     setTab]     = useState('pipeline')  // 'pipeline' | 'revenue'
  const [revenue, setRevenue] = useState([])
  const [revLoading, setRevLoading] = useState(false)
  const [revFilter, setRevFilter] = useState('')
  const [revSort,   setRevSort]   = useState('ytd')   // 'ytd' | 'name' | 'recent'

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
    const ds = supabase.channel('deals-ch').on('postgres_changes',{event:'*',schema:'public',table:'deals'},loadAll).subscribe()
    const as = supabase.channel('acts-ch').on('postgres_changes',{event:'*',schema:'public',table:'activity'},loadAll).subscribe()
    return () => { supabase.removeChannel(ds); supabase.removeChannel(as) }
  }, [loadAll])

  const loadRevenue = useCallback(async () => {
    setRevLoading(true)
    try {
      const { data, error: e } = await supabase
        .from('revenue')
        .select('date, advertiser, revenue')
        .order('date', { ascending: true })
      if (e) throw e
      setRevenue(data || [])
    } catch(e) { console.error(e) }
    finally { setRevLoading(false) }
  }, [])

  useEffect(() => {
    if (tab === 'revenue' && revenue.length === 0) loadRevenue()
  }, [tab, loadRevenue])

  const chooseUser = (name) => { localStorage.setItem(USER_KEY, name); setUser(name) }
  const log = async (dealId, type, text) =>
    supabase.from('activity').insert({ id: uid(), deal_id: dealId, user: user||'?', type, text, created_at: new Date().toISOString() })

  const openNew  = () => { setForm({...BLANK, owner: user||'Alby'}); setSel('new'); setComment('') }
  const openDeal = (deal) => { setForm({...deal}); setSel(deal.id); setComment('') }
  const closePanel = () => { setSel(null); setForm(null); setComment('') }

  const save = async () => {
    if (!form?.company?.trim() && !form?.brand?.trim() && !form?.campaign?.trim()) return
    setSaving(true)
    try {
      const payload = {...form, value: Number(form.value)||0, updated_at: new Date().toISOString()}
      if (sel === 'new') {
        payload.id = uid()
        payload.created_at = new Date().toISOString()
        const { error: e } = await supabase.from('deals').insert(payload)
        if (e) throw e
        await log(payload.id, 'created', 'created this deal')
        setSel(payload.id); setForm(payload)
      } else {
        const old = deals.find(d => d.id === sel)
        const { error: e } = await supabase.from('deals').update(payload).eq('id', sel)
        if (e) throw e
        if (old.stage       !== payload.stage)       await log(sel, 'stage',  `moved to ${payload.stage}`)
        if (old.owner       !== payload.owner)       await log(sel, 'assign', `assigned CS to ${payload.owner}`)
        if (old.sales_owner !== payload.sales_owner) await log(sel, 'assign', `assigned Sales to ${payload.sales_owner}`)
        if (Number(old.value) !== Number(payload.value)) await log(sel, 'value', `updated value: ${money(old.value)} → ${money(payload.value)}`)
      }
    } catch(e) { alert('Save failed: ' + e.message) }
    finally { setSaving(false) }
  }

  const deleteDeal = async () => {
    if (!confirm('Delete this deal? Cannot be undone.')) return
    await supabase.from('deals').delete().eq('id', sel)
    closePanel()
  }

  const postComment = async () => {
    if (!comment.trim() || !sel || sel === 'new') return
    await log(sel, 'comment', comment.trim())
    setComment('')
  }

  const exportCSV = () => {
    const hdr  = ['Agency','Brand','Campaign','Vertical','Stage','Status','CS Owner','Sales Owner','DSP','SSP','Product','Media Type','KPIs','Macro','Value','Close Date','Flight Start','Flight End','Last Outreach','Notes']
    const rows = deals.map(d =>
      [d.company,d.brand,d.campaign,d.vertical,d.stage,d.status,d.owner,d.sales_owner,d.dsp,d.ssp,d.product,d.media_type,d.kpis,d.macro,d.value,d.close_date,d.flight_start,d.flight_end,d.last_outreach,d.notes]
        .map(v => `"${(v||'').toString().replace(/"/g,'""')}"`)
        .join(',')
    )
    const blob = new Blob([[hdr.join(','),...rows].join('\n')],{type:'text/csv'})
    Object.assign(document.createElement('a'),{href:URL.createObjectURL(blob),download:'illuma-pipeline.csv'}).click()
  }

  const filtered = useMemo(() => {
    let list = [...deals]
    if (fStage !== 'All') list = list.filter(d => d.stage === fStage)
    if (fOwner !== 'All') list = list.filter(d => d.owner === fOwner || d.sales_owner === fOwner)
    if (fVert  !== 'All') list = list.filter(d => d.vertical === fVert)
    if (fQ.trim()) {
      const q = fQ.toLowerCase()
      list = list.filter(d => ['company','brand','campaign'].some(k => (d[k]||'').toLowerCase().includes(q)))
    }
    list.sort((a,b) => {
      if (sortBy === 'value')   return Number(b.value) - Number(a.value)
      if (sortBy === 'company') return (a.company||'').localeCompare(b.company||'')
      if (sortBy === 'brand')   return (a.brand||'').localeCompare(b.brand||'')
      return new Date(a.close_date||'9999') - new Date(b.close_date||'9999')
    })
    return list
  }, [deals, fStage, fOwner, fVert, fQ, sortBy])

  const metrics = useMemo(() => {
    const active = deals.filter(d => !['Closed Won','Closed Lost'].includes(d.stage))
    const won    = deals.filter(d => d.stage === 'Closed Won')
    const closed = deals.filter(d => ['Closed Won','Closed Lost'].includes(d.stage))
    return {
      pipe: active.reduce((s,d)=>s+Number(d.value||0),0),
      won:  won.reduce((s,d)=>s+Number(d.value||0),0),
      wr:   closed.length ? Math.round(won.length/closed.length*100) : 0,
      cnt:  active.length,
    }
  }, [deals])

  const dealActs = useMemo(() =>
    acts.filter(a => a.deal_id === sel).sort((a,b) => new Date(b.created_at)-new Date(a.created_at))
  ,[acts,sel])

  const inp  = (key, placeholder, type='text') =>
    <input className="inp" type={type} placeholder={placeholder} value={form[key]||''} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} />
  const sel_ = (key, opts, blank) =>
    <select className="inp" value={form[key]||''} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))}>
      {blank && <option value="">— select —</option>}
      {opts.map(o=><option key={o}>{o}</option>)}
    </select>

  const panelOpen = !!(sel && form)

  // Password gate
  if (!authed) return (
    <div style={{minHeight:360,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:28}}>
      <style>{css}</style>
      <div style={{textAlign:'center'}}>
        <div style={{fontSize:22,fontWeight:500,marginBottom:6}}>Illuma Pipeline</div>
        <div style={{fontSize:13,color:'#888'}}>Enter the team password to continue</div>
      </div>
      <div style={{width:280,display:'flex',flexDirection:'column',gap:10}}>
        <input className="inp" type="password" placeholder="Password" value={pwInput} autoFocus
          style={{fontSize:15,padding:'10px 12px',borderColor:pwError?'#F43F5E':'#D4D0C8'}}
          onChange={e=>{setPwInput(e.target.value);setPwError(false)}}
          onKeyDown={e=>{
            if(e.key==='Enter'){
              if(pwInput===PASSWORD){localStorage.setItem(AUTH_KEY,PASSWORD);setAuthed(true)}
              else{setPwError(true);setPwInput('')}
            }
          }}/>
        {pwError && <div style={{fontSize:12,color:'#E24B4A',textAlign:'center'}}>Incorrect password.</div>}
        <button className="btn p" style={{padding:'10px',fontSize:14}} onClick={()=>{
          if(pwInput===PASSWORD){localStorage.setItem(AUTH_KEY,PASSWORD);setAuthed(true)}
          else{setPwError(true);setPwInput('')}
        }}>Enter</button>
      </div>
      <div style={{fontSize:11,color:'#bbb'}}>Ask Alby for the password</div>
    </div>
  )

  // User picker
  if (!user) return (
    <div style={{minHeight:300,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:24}}>
      <style>{css}</style>
      <div style={{textAlign:'center'}}>
        <div style={{fontSize:22,fontWeight:500,marginBottom:4}}>Illuma Pipeline</div>
        <div style={{fontSize:14,color:'#888'}}>Who are you?</div>
      </div>
      <div style={{display:'flex',gap:10,flexWrap:'wrap',justifyContent:'center'}}>
        {TEAM.map(name=>(
          <button key={name} onClick={()=>chooseUser(name)}
            style={{padding:'12px 24px',borderRadius:10,border:'1px solid #D4D0C8',background:'#fff',cursor:'pointer',fontSize:14,fontWeight:500,fontFamily:'inherit',display:'flex',alignItems:'center',gap:8}}
            onMouseEnter={e=>e.currentTarget.style.background='#F0EEE9'}
            onMouseLeave={e=>e.currentTarget.style.background='#fff'}>
            <div style={{width:30,height:30,borderRadius:'50%',background:OC[name],display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:500,color:'white'}}>{ini(name)}</div>
            {name}
          </button>
        ))}
      </div>
    </div>
  )

  if (loading) return <div style={{height:200,display:'flex',alignItems:'center',justifyContent:'center',gap:10,color:'#888'}}><style>{css}</style><div className="spin"/>Loading pipeline…</div>
  if (error)   return <div style={{height:200,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:12,color:'#888'}}><style>{css}</style><div style={{fontWeight:500,color:'#E24B4A'}}>Connection error</div><div style={{fontSize:13}}>{error}</div><button className="btn p" onClick={loadAll}>Retry</button></div>

  return (
    <div>
      <style>{css}</style>

      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12,flexWrap:'wrap',gap:8}}>
        <div style={{display:'flex',alignItems:'center',gap:16}}>
          <div style={{fontSize:18,fontWeight:500}}>Illuma</div>
          <div style={{display:'flex',background:'#EDEBE6',borderRadius:8,padding:2}}>
            {[['pipeline','Pipeline'],['revenue','Revenue']].map(([t,label])=>(
              <button key={t} onClick={()=>setTab(t)}
                style={{padding:'4px 16px',borderRadius:6,border:'none',background:tab===t?'#fff':'transparent',cursor:'pointer',fontSize:12,fontWeight:tab===t?500:400,fontFamily:'inherit',color:'#1A1A1A',boxShadow:tab===t?'0 0 0 1px #D4D0C8':'none'}}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div style={{display:'flex',gap:7,alignItems:'center',flexWrap:'wrap'}}>
          {tab==='pipeline' && <><button className="btn" onClick={exportCSV} style={{fontSize:11}}>Export CSV</button><button className="btn p" onClick={openNew}>+ New deal</button></>}
          <div style={{display:'flex',alignItems:'center',gap:6,padding:'3px 10px 3px 6px',border:'1px solid #D4D0C8',borderRadius:20,background:'#fff'}}>
            <Avatar name={user} size={22}/>
            <select value={user} onChange={e=>chooseUser(e.target.value)}
              style={{border:'none',background:'transparent',fontSize:12,fontWeight:500,cursor:'pointer',outline:'none',fontFamily:'inherit',color:'#1A1A1A'}}>
              {TEAM.map(n=><option key={n}>{n}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:14}}>
        {[
          {label:'Active pipeline',val:money(metrics.pipe)},
          {label:'Closed won',val:money(metrics.won),green:true},
          {label:'Win rate',val:`${metrics.wr}%`},
        ].map(({label,val,green})=>(
          <div key={label} style={{background:'#EDEBE6',borderRadius:8,padding:'10px 14px'}}>
            <div style={{fontSize:10,color:'#888',marginBottom:3,textTransform:'uppercase',letterSpacing:'0.06em'}}>{label}</div>
            <div style={{fontSize:20,fontWeight:500,fontFamily:"'DM Mono',monospace",color:green?'#059669':'#1A1A1A'}}>{val}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{display:'flex',gap:7,marginBottom:12,flexWrap:'wrap',alignItems:'center'}}>
        <input className="inp" placeholder="Search agency, brand, campaign…" value={fQ} onChange={e=>setFQ(e.target.value)} style={{width:220}}/>
        <select className="inp" value={fStage} onChange={e=>setFStage(e.target.value)} style={{width:140}}>
          <option value="All">All stages</option>
          {STAGES.map(s=><option key={s}>{s}</option>)}
        </select>
        <select className="inp" value={fOwner} onChange={e=>setFOwner(e.target.value)} style={{width:110}}>
          <option value="All">All reps</option>
          {TEAM.map(t=><option key={t}>{t}</option>)}
        </select>
        <select className="inp" value={fVert} onChange={e=>setFVert(e.target.value)} style={{width:162}}>
          <option value="All">All verticals</option>
          {VERTICALS.map(v=><option key={v}>{v}</option>)}
        </select>
        <select className="inp" value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{width:130}}>
          <option value="close_date">Sort: close date</option>
          <option value="value">Sort: value</option>
          <option value="company">Sort: agency</option>
          <option value="brand">Sort: brand</option>
        </select>
        <div style={{marginLeft:'auto',display:'flex',background:'#EDEBE6',borderRadius:7,padding:2}}>
          {['list','board'].map(v=>(
            <button key={v} onClick={()=>setView(v)}
              style={{padding:'3px 14px',borderRadius:5,border:'none',background:view===v?'#fff':'transparent',cursor:'pointer',fontSize:12,fontWeight:view===v?500:400,fontFamily:'inherit',color:'#1A1A1A',boxShadow:view===v?'0 0 0 1px #D4D0C8':'none'}}>
              {v.charAt(0).toUpperCase()+v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Split layout */}
      <div style={{display:'grid',gridTemplateColumns:panelOpen?'minmax(0,1fr) 390px':'minmax(0,1fr)',gap:12,alignItems:'start'}}>

        {/* LIST — wide scrollable */}
        {view==='list' && (
          <div style={{border:'1px solid #E2DED5',borderRadius:10,overflowX:'auto',background:'#fff'}}>
            <table style={{borderCollapse:'collapse',tableLayout:'auto',minWidth:1200}}>
              <thead>
                <tr style={{background:'#F3F1EC',fontSize:10,color:'#888',textTransform:'uppercase',letterSpacing:'0.07em'}}>
                  {[
                    {label:'Brand',w:130},{label:'Campaign',w:160},{label:'Stage',w:130},
                    {label:'CS',w:90},{label:'Sales',w:90},
                    {label:'DSP',w:80},{label:'SSP',w:110},{label:'Product',w:120},{label:'Media',w:80},
                    {label:'Value',w:90,right:true},{label:'Flight start',w:105,right:true},{label:'Flight end',w:105,right:true},
                  ].map(({label,w,right})=>(
                    <th key={label} style={{padding:'9px 12px',textAlign:right?'right':'left',minWidth:w,fontWeight:500,whiteSpace:'nowrap'}}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((deal,i)=>(
                  <tr key={deal.id} className="rh" onClick={()=>openDeal(deal)}
                    style={{borderTop:i>0?'1px solid #F0EDE6':'none',background:sel===deal.id?'#F3F1EC':'transparent'}}>
                    <td style={{padding:'9px 12px',minWidth:130}}>
                      <div style={{fontSize:12,fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:130}}>{deal.brand||'—'}</div>
                      <div style={{fontSize:10,color:'#888',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:130}}>{deal.company}</div>
                    </td>
                    <td style={{padding:'9px 12px',fontSize:11,color:'#555',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:160,minWidth:160}}>{deal.campaign||'—'}</td>
                    <td style={{padding:'9px 12px',minWidth:130}}><Pill stage={deal.stage}/></td>
                    <td style={{padding:'9px 12px',minWidth:90}}>
                      <div style={{display:'flex',alignItems:'center',gap:4}}>
                        <Avatar name={deal.owner} size={18}/>
                        <span style={{fontSize:11}}>{deal.owner}</span>
                      </div>
                    </td>
                    <td style={{padding:'9px 12px',minWidth:90}}>
                      {deal.sales_owner
                        ? <div style={{display:'flex',alignItems:'center',gap:4}}><Avatar name={deal.sales_owner} size={18}/><span style={{fontSize:11}}>{deal.sales_owner}</span></div>
                        : <span style={{fontSize:11,color:'#ccc'}}>—</span>}
                    </td>
                    <td style={{padding:'9px 12px',fontSize:11,color:'#555',whiteSpace:'nowrap',minWidth:80}}>{deal.dsp||'—'}</td>
                    <td style={{padding:'9px 12px',fontSize:11,color:'#555',whiteSpace:'nowrap',minWidth:110}}>{deal.ssp||'—'}</td>
                    <td style={{padding:'9px 12px',fontSize:11,color:'#555',whiteSpace:'nowrap',minWidth:120}}>{deal.product||'—'}</td>
                    <td style={{padding:'9px 12px',minWidth:80}}>
                      {deal.media_type
                        ? <span style={{fontSize:10,background:'#F1F5F9',color:'#475569',padding:'2px 7px',borderRadius:10,fontWeight:500,whiteSpace:'nowrap'}}>{deal.media_type}</span>
                        : <span style={{fontSize:11,color:'#ccc'}}>—</span>}
                    </td>
                    <td style={{padding:'9px 12px',textAlign:'right',fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:500,whiteSpace:'nowrap',minWidth:90}}>{money(deal.value)}</td>
                    <td style={{padding:'9px 12px',textAlign:'right',fontSize:11,color:'#888',whiteSpace:'nowrap',minWidth:105}}>{fmtDate(deal.flight_start)}</td>
                    <td style={{padding:'9px 12px',textAlign:'right',fontSize:11,color:'#888',whiteSpace:'nowrap',minWidth:105}}>{fmtDate(deal.flight_end)}</td>
                  </tr>
                ))}
                {filtered.length===0 && <tr><td colSpan={12} style={{padding:'32px',textAlign:'center',color:'#aaa',fontSize:13}}>No results</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {/* BOARD */}
        {view==='board' && (
          <div style={{display:'flex',gap:8,overflowX:'auto',paddingBottom:6}}>
            {STAGES.map(stage=>{
              const cd=deals.filter(d=>d.stage===stage)
              const tot=cd.reduce((s,d)=>s+Number(d.value||0),0)
              const m=SM[stage]
              return (
                <div key={stage} style={{background:'#EDEBE6',borderRadius:10,padding:10,flex:'0 0 172px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                    <div style={{display:'flex',alignItems:'center',gap:4}}>
                      <span style={{width:6,height:6,borderRadius:'50%',background:m.dot,display:'inline-block'}}/>
                      <span style={{fontSize:10,fontWeight:500}}>{stage}</span>
                      <span style={{fontSize:9,color:'#888',background:'#fff',border:'1px solid #E2DED5',borderRadius:10,padding:'1px 5px'}}>{cd.length}</span>
                    </div>
                    <span style={{fontSize:9,color:'#888',fontFamily:"'DM Mono',monospace"}}>{money(tot)}</span>
                  </div>
                  {cd.map(deal=>(
                    <div key={deal.id} className="card-hover" onClick={()=>openDeal(deal)}
                      style={{padding:'8px 9px',marginBottom:6,borderColor:sel===deal.id?'#999':'#E2DED5'}}>
                      <div style={{fontSize:10,color:'#888',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginBottom:2}}>{deal.company}</div>
                      <div style={{fontSize:11,fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginBottom:5}}>{deal.brand||deal.campaign||'—'}</div>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <Avatar name={deal.owner} size={18}/>
                        <span style={{fontSize:11,fontFamily:"'DM Mono',monospace",fontWeight:500}}>{money(deal.value)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        )}

        {/* PANEL */}
        {panelOpen && (
          <div style={{border:'1px solid #D4D0C8',borderRadius:10,overflow:'hidden',background:'#fff'}}>
            <div style={{padding:'10px 14px',borderBottom:'1px solid #E2DED5',display:'flex',justifyContent:'space-between',alignItems:'center',background:'#F3F1EC'}}>
              <div style={{fontSize:13,fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1,marginRight:6}}>
                {sel==='new'?'New opportunity':(form.brand||form.company||form.campaign||'Untitled')}
              </div>
              <div style={{display:'flex',gap:5,flexShrink:0}}>
                {sel!=='new' && <button className="btn" onClick={deleteDeal} style={{fontSize:11,color:'#DC2626',borderColor:'#FCA5A5'}}>Delete</button>}
                <button className="btn" onClick={closePanel} style={{fontSize:11}}>✕</button>
                <button className="btn p" onClick={save} disabled={saving} style={{fontSize:11}}>{saving?'Saving…':'Save'}</button>
              </div>
            </div>

            <div style={{overflowY:'auto',maxHeight:780,padding:'14px 14px 0'}}>

              {/* Campaign info */}
              <div style={{fontSize:9,fontWeight:500,textTransform:'uppercase',letterSpacing:'0.1em',color:'#bbb',marginBottom:8}}>Campaign info</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:2}}>
                <F label="Agency">{inp('company','OMD, PHM, Publicis…')}</F>
                <F label="Brand / Parent Co.">{inp('brand','Novartis, Apple…')}</F>
                <F label="Campaign" span>{inp('campaign','Campaign name')}</F>
                <F label="Vertical">{sel_('vertical',VERTICALS)}</F>
                <F label="DSP">{sel_('dsp',DSPS,true)}</F>
                <F label="SSP">{sel_('ssp',SSPS,true)}</F>
                <F label="Product">{inp('product','Reacts, Smart Category…')}</F>
                <F label="Media Type">{sel_('media_type',MEDIA_TYPES,true)}</F>
              </div>

              {/* Status */}
              <div className="sec">Status</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:2}}>
                <F label="Stage">{sel_('stage',STAGES)}</F>
                <F label="Live status">{inp('status','Live, Complete, Cancelled…')}</F>
                <F label="Macro">{sel_('macro',['Yes','No'],true)}</F>
              </div>

              {/* People */}
              <div className="sec">People</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:2}}>
                <F label="CS Owner">{sel_('owner',TEAM)}</F>
                <F label="Sales Owner">{sel_('sales_owner',TEAM,true)}</F>
                <F label="Last Outreach" span>{inp('last_outreach','','date')}</F>
              </div>

              {/* Financials */}
              <div className="sec">Financials & dates</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:2}}>
                <F label="Value ($)">{inp('value','50000','number')}</F>
                <F label="Close date">{inp('close_date','','date')}</F>
                <F label="Flight start">{inp('flight_start','','date')}</F>
                <F label="Flight end">{inp('flight_end','','date')}</F>
              </div>

              {/* KPIs & Notes */}
              <div className="sec">KPIs & notes</div>
              <div style={{marginBottom:6}}>
                <label className="fl">KPIs</label>
                <input className="inp" placeholder="CTR, VCR, ROAS…" value={form.kpis||''} onChange={e=>setForm(f=>({...f,kpis:e.target.value}))} style={{marginBottom:8}}/>
                <label className="fl">Notes</label>
                <textarea className="inp" rows={3} style={{resize:'vertical'}} value={form.notes||''} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/>
              </div>

              {/* Activity */}
              {sel!=='new' && (
                <div style={{borderTop:'1px solid #E2DED5',padding:'12px 0 16px'}}>
                  <div style={{fontSize:10,fontWeight:500,textTransform:'uppercase',letterSpacing:'0.07em',color:'#888',marginBottom:12}}>Activity</div>
                  <div style={{display:'flex',gap:8,marginBottom:16,alignItems:'flex-start'}}>
                    <Avatar name={user} size={26}/>
                    <div style={{flex:1}}>
                      <textarea className="inp" rows={2} placeholder="Add a note or update…" value={comment}
                        onChange={e=>setComment(e.target.value)}
                        onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();postComment()}}}
                        style={{resize:'none',marginBottom:6}}/>
                      <button className="btn p" onClick={postComment} style={{fontSize:11}}>Post</button>
                    </div>
                  </div>
                  {dealActs.length===0
                    ? <div style={{fontSize:12,color:'#aaa',textAlign:'center',padding:'8px 0'}}>No activity yet.</div>
                    : dealActs.map(entry=>(
                      <div key={entry.id} style={{display:'flex',gap:8,marginBottom:14}}>
                        <Avatar name={entry.user} size={24}/>
                        <div style={{flex:1,minWidth:0}}>
                          {entry.type==='comment'
                            ? <><div style={{fontSize:11,color:'#888',marginBottom:3}}><span style={{fontWeight:500,color:'#1A1A1A'}}>{entry.user}</span> commented</div><div style={{fontSize:12,background:'#F3F1EC',borderRadius:6,padding:'6px 9px'}}>{entry.text}</div></>
                            : <div style={{fontSize:11,color:'#888'}}><span style={{fontWeight:500,color:'#1A1A1A'}}>{entry.user}</span> {entry.text}</div>
                          }
                          <div style={{fontSize:10,color:'#aaa',marginTop:3}}>{fmtTS(entry.created_at)}</div>
                        </div>
                      </div>
                    ))
                  }
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── REVENUE TAB ── */}
      {tab==='revenue' && <RevenueDashboard revenue={revenue} loading={revLoading} filter={revFilter} setFilter={setRevFilter} sort={revSort} setSort={setRevSort} />}
    </div>
  )
}

// ── Revenue Dashboard ──────────────────────────────────────────────────────
function RevenueDashboard({ revenue, loading, filter, setFilter, sort, setSort }) {
  const money = (n) => '$' + Math.round(Number(n)||0).toLocaleString()
  const fmt2  = (n) => '$' + Number(n||0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

  const ytdByAdv = useMemo(() => {
    const m = {}
    revenue.forEach(r => {
      if (!m[r.advertiser]) m[r.advertiser] = { ytd: 0, days: {}, recent: 0 }
      m[r.advertiser].ytd += Number(r.revenue)
      m[r.advertiser].days[r.date] = (m[r.advertiser].days[r.date]||0) + Number(r.revenue)
    })
    // recent = last 7 days avg
    const allDates = [...new Set(revenue.map(r=>r.date))].sort()
    const last7 = new Set(allDates.slice(-7))
    Object.keys(m).forEach(adv => {
      const last7rev = Object.entries(m[adv].days).filter(([d])=>last7.has(d)).reduce((s,[,v])=>s+v,0)
      m[adv].recent = last7rev / 7
    })
    return m
  }, [revenue])

  const dailyTotals = useMemo(() => {
    const m = {}
    revenue.forEach(r => { m[r.date] = (m[r.date]||0) + Number(r.revenue) })
    return Object.entries(m).sort((a,b)=>a[0].localeCompare(b[0]))
  }, [revenue])

  const totalYTD   = useMemo(() => revenue.reduce((s,r)=>s+Number(r.revenue),0), [revenue])
  const last7Avg   = useMemo(() => {
    const allDates = [...new Set(revenue.map(r=>r.date))].sort()
    const last7    = new Set(allDates.slice(-7))
    const sum = revenue.filter(r=>last7.has(r.date)).reduce((s,r)=>s+Number(r.revenue),0)
    return sum / 7
  }, [revenue])

  const advertisers = useMemo(() => {
    let list = Object.entries(ytdByAdv).map(([name,d])=>({name,...d}))
    if (filter.trim()) {
      const q = filter.toLowerCase()
      list = list.filter(a=>a.name.toLowerCase().includes(q))
    }
    if (sort==='ytd')    list.sort((a,b)=>b.ytd-a.ytd)
    if (sort==='name')   list.sort((a,b)=>a.name.localeCompare(b.name))
    if (sort==='recent') list.sort((a,b)=>b.recent-a.recent)
    return list
  }, [ytdByAdv, filter, sort])

  const topYTD = advertisers.length > 0 ? advertisers[0].ytd : 1

  // Mini sparkline: last 30 days for a given advertiser
  const Sparkline = ({ adv }) => {
    const allDates = [...new Set(revenue.map(r=>r.date))].sort().slice(-30)
    const vals = allDates.map(d => ytdByAdv[adv]?.days[d] || 0)
    const max = Math.max(...vals, 1)
    const w = 80, h = 24
    const pts = vals.map((v,i)=>`${(i/(vals.length-1))*w},${h-(v/max)*h}`).join(' ')
    return (
      <svg width={w} height={h} style={{display:'block'}}>
        <polyline points={pts} fill="none" stroke="#10B981" strokeWidth="1.5" strokeLinejoin="round"/>
      </svg>
    )
  }

  // Daily chart: last 60 days bar chart
  const DailyChart = () => {
    const days = dailyTotals.slice(-60)
    const max = Math.max(...days.map(([,v])=>v), 1)
    const w = 100, barW = Math.max(2, Math.floor(w/days.length)-1)
    return (
      <div style={{overflowX:'auto',paddingBottom:4}}>
        <svg width={Math.max(600, days.length * (barW+1))} height={80} style={{display:'block'}}>
          {days.map(([date,val],i)=>{
            const bh = Math.max(1, (val/max)*72)
            const x = i*(barW+1)
            return <rect key={date} x={x} y={80-bh-4} width={barW} height={bh}
              fill={i===days.length-1?'#6366F1':'#D1FAE5'} rx="1"
              title={`${date}: ${money(val)}`}/>
          })}
        </svg>
        <div style={{display:'flex',justifyContent:'space-between',fontSize:9,color:'#aaa',marginTop:2,paddingRight:4}}>
          <span>{days[0]?.[0]}</span>
          <span>{days[days.length-1]?.[0]}</span>
        </div>
      </div>
    )
  }

  if (loading) return <div style={{height:200,display:'flex',alignItems:'center',justifyContent:'center',gap:10,color:'#888'}}><div className="spin"/>Loading revenue…</div>
  if (revenue.length===0) return <div style={{height:200,display:'flex',alignItems:'center',justifyContent:'center',color:'#aaa',fontSize:13}}>No revenue data yet.</div>

  const lastDate = dailyTotals.length > 0 ? dailyTotals[dailyTotals.length-1][0] : '—'
  const lastDayRev = dailyTotals.length > 0 ? dailyTotals[dailyTotals.length-1][1] : 0

  return (
    <div>
      {/* Summary metrics */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:16}}>
        {[
          {label:'YTD Revenue',      val:money(totalYTD)},
          {label:'7-day avg / day',  val:money(last7Avg)},
          {label:`Last day (${lastDate})`, val:money(lastDayRev), accent:true},
        ].map(({label,val,accent})=>(
          <div key={label} style={{background:'#EDEBE6',borderRadius:8,padding:'10px 14px'}}>
            <div style={{fontSize:10,color:'#888',marginBottom:3,textTransform:'uppercase',letterSpacing:'0.06em'}}>{label}</div>
            <div style={{fontSize:20,fontWeight:500,fontFamily:"'DM Mono',monospace",color:accent?'#6366F1':'#1A1A1A'}}>{val}</div>
          </div>
        ))}
      </div>

      {/* Daily revenue chart */}
      <div style={{border:'1px solid #E2DED5',borderRadius:10,background:'#fff',padding:'14px 16px',marginBottom:14}}>
        <div style={{fontSize:11,fontWeight:500,marginBottom:10,color:'#555'}}>Daily revenue — last 60 days</div>
        <DailyChart/>
      </div>

      {/* Advertiser table */}
      <div style={{display:'flex',gap:7,marginBottom:10,alignItems:'center',flexWrap:'wrap'}}>
        <input className="inp" placeholder="Search advertiser…" value={filter} onChange={e=>setFilter(e.target.value)} style={{width:200}}/>
        <select className="inp" value={sort} onChange={e=>setSort(e.target.value)} style={{width:160}}>
          <option value="ytd">Sort: YTD revenue</option>
          <option value="recent">Sort: 7-day avg</option>
          <option value="name">Sort: A–Z</option>
        </select>
        <div style={{marginLeft:'auto',fontSize:11,color:'#888'}}>{advertisers.length} advertisers</div>
      </div>

      <div style={{border:'1px solid #E2DED5',borderRadius:10,overflow:'hidden',background:'#fff'}}>
        <table style={{width:'100%',borderCollapse:'collapse',tableLayout:'fixed'}}>
          <thead>
            <tr style={{background:'#F3F1EC',fontSize:10,color:'#888',textTransform:'uppercase',letterSpacing:'0.07em'}}>
              <th style={{padding:'9px 14px',textAlign:'left',width:'28%',fontWeight:500}}>Advertiser</th>
              <th style={{padding:'9px 14px',textAlign:'left',width:'28%',fontWeight:500}}>YTD pacing</th>
              <th style={{padding:'9px 14px',textAlign:'right',width:'16%',fontWeight:500}}>YTD total</th>
              <th style={{padding:'9px 14px',textAlign:'right',width:'14%',fontWeight:500}}>7d avg/day</th>
              <th style={{padding:'9px 14px',textAlign:'right',width:'14%',fontWeight:500}}>Last 30d trend</th>
            </tr>
          </thead>
          <tbody>
            {advertisers.map((adv,i)=>{
              const pct = Math.min(100, Math.round((adv.ytd/topYTD)*100))
              return (
                <tr key={adv.name} style={{borderTop:i>0?'1px solid #F0EDE6':'none'}}>
                  <td style={{padding:'10px 14px',fontSize:12,fontWeight:500}}>{adv.name}</td>
                  <td style={{padding:'10px 14px'}}>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <div style={{flex:1,height:6,background:'#F1F5F9',borderRadius:3,overflow:'hidden'}}>
                        <div style={{width:`${pct}%`,height:'100%',background:'#10B981',borderRadius:3}}/>
                      </div>
                      <span style={{fontSize:10,color:'#888',minWidth:28,textAlign:'right'}}>{pct}%</span>
                    </div>
                  </td>
                  <td style={{padding:'10px 14px',textAlign:'right',fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:500}}>{money(adv.ytd)}</td>
                  <td style={{padding:'10px 14px',textAlign:'right',fontFamily:"'DM Mono',monospace",fontSize:11,color:'#555'}}>{fmt2(adv.recent)}</td>
                  <td style={{padding:'10px 14px',display:'flex',justifyContent:'flex-end'}}><Sparkline adv={adv.name}/></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
