import { useState } from 'react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500 text-xl font-bold">E</div>
          <span className="text-xl font-bold tracking-tight">enerjabze</span>
        </div>
        <nav className="flex items-center gap-6">
          <a href="#ozellikler" className="text-sm text-slate-300 hover:text-white transition-colors">Özellikler</a>
          <a href="#iletisim" className="text-sm text-slate-300 hover:text-white transition-colors">İletişim</a>
          <a href="/admin" className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium hover:bg-indigo-400 transition-colors">Yönetim Paneli</a>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-8 py-24 text-center">
        <h1 className="text-5xl font-extrabold leading-tight tracking-tight sm:text-6xl">
          Elektrik Dağıtım
          <span className="block bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">Yönetim Sistemi</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-300">
          Proje takibi, keşif yönetimi, DXF çizim editörü, saha haritası ve depo yönetimi — tek platformda.
        </p>
        <div className="mt-10 flex justify-center gap-4">
          <a href="#iletisim" className="rounded-xl bg-indigo-500 px-8 py-3 text-sm font-semibold shadow-lg shadow-indigo-500/30 hover:bg-indigo-400 transition-colors">Demo Talep Et</a>
          <a href="#ozellikler" className="rounded-xl border border-slate-600 px-8 py-3 text-sm font-semibold hover:bg-slate-800 transition-colors">Özellikleri Gör</a>
        </div>
      </section>

      {/* Özellikler */}
      <section id="ozellikler" className="mx-auto max-w-6xl px-8 py-20">
        <h2 className="text-center text-3xl font-bold">Temel Özellikler</h2>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: '📐', title: 'DXF Çizim Editörü', desc: 'Proje çizimlerini doğrudan tarayıcıda görüntüleyin, malzeme ekleyin ve metraj çıkarın.' },
            { icon: '🗺️', title: 'Saha Haritası', desc: 'Tüm projeleri harita üzerinde görün, uydu görüntüsü ve proje çizimleri ile.' },
            { icon: '📦', title: 'Depo Yönetimi', desc: 'Malzeme stok takibi, bono/irsaliye girişi, hareket yönetimi.' },
            { icon: '📋', title: 'Keşif ve Hakediş', desc: 'Proje keşif listeleri, malzeme katalog entegrasyonu, fiyat hesaplama.' },
            { icon: '👥', title: 'Ekip Yönetimi', desc: 'Personel, ekip ve görev takibi. Puantaj ve raporlama.' },
            { icon: '🔄', title: 'Yaşam Döngüsü', desc: 'Proje fazları, adım takibi, dosya yönetimi — baştan sona proje kontrolü.' },
          ].map((f, i) => (
            <div key={i} className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-6 backdrop-blur-sm">
              <span className="text-3xl">{f.icon}</span>
              <h3 className="mt-3 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-slate-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* İletişim */}
      <section id="iletisim" className="mx-auto max-w-2xl px-8 py-20 text-center">
        <h2 className="text-3xl font-bold">İletişim</h2>
        <p className="mt-4 text-slate-400">Demo veya fiyat bilgisi için bizimle iletişime geçin.</p>
        <div className="mt-8 rounded-xl border border-slate-700/50 bg-slate-800/50 p-8">
          <p className="text-lg font-medium">info@enerjabze.tr</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 px-8 py-6 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} enerjabze — Tüm hakları saklıdır.
      </footer>
    </div>
  )
}
