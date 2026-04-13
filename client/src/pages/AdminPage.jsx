import { useState, useEffect } from 'react'

const API = '/api/admin'

export default function AdminPage() {
  const [token, setToken] = useState(() => localStorage.getItem('admin_token') || '')
  const [sifre, setSifre] = useState('')
  const [girisHata, setGirisHata] = useState('')
  const [tenants, setTenants] = useState([])
  const [yeniForm, setYeniForm] = useState({ slug: '', name: '' })
  const [yukleniyor, setYukleniyor] = useState(false)

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

  const girisYap = async (e) => {
    e.preventDefault()
    setGirisHata('')
    try {
      const r = await fetch(`${API}/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: sifre }) })
      const j = await r.json()
      if (j.success) {
        setToken(j.data.token)
        localStorage.setItem('admin_token', j.data.token)
      } else {
        setGirisHata(j.error || 'Giriş başarısız')
      }
    } catch { setGirisHata('Bağlantı hatası') }
  }

  const cikisYap = () => { setToken(''); localStorage.removeItem('admin_token') }

  const firmalariYukle = async () => {
    try {
      const r = await fetch(`${API}/tenants`, { headers })
      const j = await r.json()
      if (j.success) setTenants(j.data)
      else if (r.status === 401) { cikisYap() }
    } catch {}
  }

  const firmaOlustur = async (e) => {
    e.preventDefault()
    if (!yeniForm.slug || !yeniForm.name) return
    setYukleniyor(true)
    try {
      const r = await fetch(`${API}/tenants`, { method: 'POST', headers, body: JSON.stringify(yeniForm) })
      const j = await r.json()
      if (j.success) {
        setYeniForm({ slug: '', name: '' })
        firmalariYukle()
        alert(`Firma oluşturuldu! URL: ${j.data.url}`)
      } else {
        alert(j.error || 'Hata')
      }
    } catch { alert('Bağlantı hatası') }
    finally { setYukleniyor(false) }
  }

  const firmaDurumDegistir = async (slug, active) => {
    await fetch(`${API}/tenants/${slug}`, { method: 'PUT', headers, body: JSON.stringify({ active }) })
    firmalariYukle()
  }

  useEffect(() => { if (token) firmalariYukle() }, [token])

  const baseDomain = window.location.hostname === 'localhost' ? 'localhost:4000' : (window.location.hostname.split('.').slice(1).join('.') || 'enerjabze.tr')

  // Giriş formu
  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <form onSubmit={girisYap} className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-800 p-8 shadow-xl">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-indigo-500 text-2xl font-bold text-white">E</div>
            <h1 className="text-xl font-bold text-white">enerjabze Yönetim</h1>
            <p className="mt-1 text-sm text-slate-400">Süper Admin Girişi</p>
          </div>
          {girisHata && <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-2 text-sm text-red-400">{girisHata}</div>}
          <input type="password" value={sifre} onChange={e => setSifre(e.target.value)} placeholder="Admin şifresi"
            className="mb-4 w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-3 text-white placeholder-slate-400 focus:border-indigo-500 focus:outline-none" autoFocus />
          <button type="submit" className="w-full rounded-lg bg-indigo-500 py-3 font-semibold text-white hover:bg-indigo-400 transition-colors">Giriş Yap</button>
          <a href="/" className="mt-4 block text-center text-xs text-slate-500 hover:text-slate-300">← Ana Sayfaya Dön</a>
        </form>
      </div>
    )
  }

  // Admin paneli
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="flex items-center justify-between border-b border-slate-700 px-8 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500 text-lg font-bold">E</div>
          <span className="text-lg font-bold">enerjabze Admin</span>
        </div>
        <button onClick={cikisYap} className="text-sm text-slate-400 hover:text-white">Çıkış</button>
      </header>

      <main className="mx-auto max-w-4xl px-8 py-10">
        {/* Yeni Firma */}
        <div className="mb-8 rounded-xl border border-slate-700 bg-slate-800 p-6">
          <h2 className="mb-4 text-lg font-semibold">Yeni Firma Oluştur</h2>
          <form onSubmit={firmaOlustur} className="flex flex-wrap gap-3">
            <input value={yeniForm.name} onChange={e => setYeniForm(p => ({ ...p, name: e.target.value }))} placeholder="Firma Adı"
              className="flex-1 min-w-[200px] rounded-lg border border-slate-600 bg-slate-700 px-4 py-2 text-sm text-white placeholder-slate-400 focus:border-indigo-500 focus:outline-none" />
            <div className="flex items-center gap-1 rounded-lg border border-slate-600 bg-slate-700 px-3">
              <input value={yeniForm.slug} onChange={e => setYeniForm(p => ({ ...p, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '') }))} placeholder="url-slug"
                className="w-32 bg-transparent py-2 text-sm text-white placeholder-slate-400 focus:outline-none" />
              <span className="text-xs text-slate-400">.{baseDomain}</span>
            </div>
            <button type="submit" disabled={yukleniyor} className="rounded-lg bg-indigo-500 px-6 py-2 text-sm font-semibold hover:bg-indigo-400 disabled:opacity-50 transition-colors">
              {yukleniyor ? 'Oluşturuluyor...' : 'Oluştur'}
            </button>
          </form>
        </div>

        {/* Firma Listesi */}
        <div className="rounded-xl border border-slate-700 bg-slate-800">
          <div className="border-b border-slate-700 px-6 py-4">
            <h2 className="text-lg font-semibold">Firmalar ({tenants.length})</h2>
          </div>
          <div className="divide-y divide-slate-700">
            {tenants.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-slate-500">Henüz firma yok</div>
            ) : tenants.map(t => (
              <div key={t.slug} className="flex items-center justify-between px-6 py-4">
                <div>
                  <div className="flex items-center gap-3">
                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${t.active ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                    <span className="font-medium">{t.name}</span>
                  </div>
                  <a href={`${window.location.protocol}//${t.slug}.${baseDomain}`} target="_blank" rel="noopener"
                    className="mt-1 block text-xs text-indigo-400 hover:text-indigo-300">
                    {t.slug}.{baseDomain}
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500">{t.createdAt}</span>
                  <button onClick={() => firmaDurumDegistir(t.slug, !t.active)}
                    className={`rounded-lg px-3 py-1 text-xs font-medium ${t.active ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'}`}>
                    {t.active ? 'Pasifleştir' : 'Aktifleştir'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
