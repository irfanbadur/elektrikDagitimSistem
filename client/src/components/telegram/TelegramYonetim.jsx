import { useState } from 'react'
import { useTelegramDurum, useTelegramKullanicilar, useTelegramIstatistik, useTelegramMesajLog, useTelegramAyarlarKaydet } from '@/hooks/useTelegram'
import { useAiDurum, useAiAyarlar, useAiAyarlarKaydet } from '@/hooks/useAnaliz'
import { PageSkeleton as LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import api from '@/api/client'
import { Bot, Users, MessageSquare, Activity, Settings, Wifi, WifiOff, RotateCw } from 'lucide-react'

export default function TelegramYonetim() {
  const [tab, setTab] = useState('durum')
  const { data: durumData, refetch: refetchDurum } = useTelegramDurum()
  const { data: istatistikData } = useTelegramIstatistik()
  const { data: kullaniciData } = useTelegramKullanicilar()
  const { data: mesajData } = useTelegramMesajLog({ limit: 50 })
  const { data: aiDurumData } = useAiDurum()
  const { data: aiAyarData, refetch: refetchAiAyar } = useAiAyarlar()
  const aiAyarKaydet = useAiAyarlarKaydet()
  const telegramAyarKaydet = useTelegramAyarlarKaydet()

  const durum = durumData?.data || {}
  const istatistik = istatistikData?.data || {}
  const kullanicilar = kullaniciData?.data || []
  const mesajlar = mesajData?.data || []
  const aiDurum = aiDurumData?.data || {}
  const aiAyar = aiAyarData?.data || {}

  const [ayarForm, setAyarForm] = useState({})
  const [botAyarForm, setBotAyarForm] = useState({})
  const [kaydetMesaj, setKaydetMesaj] = useState(null)
  const [botYenidenBaslat, setBotYenidenBaslat] = useState(false)

  const handleBotAyarKaydet = async () => {
    try {
      await telegramAyarKaydet.mutateAsync(botAyarForm)
      setKaydetMesaj('Ayarlar kaydedildi. Bot ayarlarinin aktif olmasi icin sunucuyu yeniden baslatin.')
      setBotAyarForm({})
      refetchAiAyar()
      setTimeout(() => setKaydetMesaj(null), 5000)
    } catch (e) {
      setKaydetMesaj('Hata: ' + e.message)
    }
  }

  const handleBotRestart = async () => {
    setBotYenidenBaslat(true)
    try {
      await api.post('/telegram/bot/restart')
      setTimeout(() => {
        refetchDurum()
        setBotYenidenBaslat(false)
      }, 2000)
    } catch (e) {
      setBotYenidenBaslat(false)
    }
  }

  const tabs = [
    { key: 'durum', label: 'Durum', icon: Activity },
    { key: 'ayarlar', label: 'Bot Ayarlari', icon: Settings },
    { key: 'kullanicilar', label: 'Kullanicilar', icon: Users },
    { key: 'mesajlar', label: 'Mesaj Log', icon: MessageSquare },
    { key: 'ai', label: 'AI Yonetimi', icon: Bot },
  ]

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">AI & Telegram Yonetimi</h2>

      <div className="flex gap-1 rounded-lg border bg-gray-50 p-1">
        {tabs.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition ${tab === t.key ? 'bg-white shadow-sm' : 'hover:bg-white/50'}`}
            >
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'durum' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="rounded-lg border bg-white p-4">
              <p className="text-sm text-gray-500">Bot Durumu</p>
              <p className={`mt-1 flex items-center gap-2 font-semibold ${durum.bot_aktif ? 'text-green-600' : 'text-red-600'}`}>
                {durum.bot_aktif ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
                {durum.bot_aktif ? 'Aktif' : 'Pasif'}
              </p>
            </div>
            <div className="rounded-lg border bg-white p-4">
              <p className="text-sm text-gray-500">Kayitli Kullanici</p>
              <p className="mt-1 text-2xl font-bold">{istatistik.toplam_kullanici || 0}</p>
            </div>
            <div className="rounded-lg border bg-white p-4">
              <p className="text-sm text-gray-500">Bugun Mesaj</p>
              <p className="mt-1 text-2xl font-bold">{istatistik.bugun_mesaj || 0}</p>
            </div>
            <div className="rounded-lg border bg-white p-4">
              <p className="text-sm text-gray-500">Toplam Mesaj</p>
              <p className="mt-1 text-2xl font-bold">{istatistik.toplam_mesaj || 0}</p>
            </div>
          </div>

          <div className="rounded-lg border bg-white p-4">
            <h3 className="mb-3 font-medium">AI Servis Durumu</h3>
            <div className="space-y-2">
              {[
                { label: 'Katman 1 (Metin)', key: 'katman1', model: aiAyar.ollama_text_model },
                { label: 'Katman 2 (Gorsel)', key: 'katman2', model: aiAyar.ollama_vision_model },
                { label: 'Katman 3 (Detayli)', key: 'katman3', model: aiDurum.cloud_provider || 'Kapali' },
              ].map((k) => (
                <div key={k.key} className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-2">
                  <span className="text-sm">{k.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{k.model || '-'}</span>
                    <span className={`h-2.5 w-2.5 rounded-full ${aiDurum[k.key] ? 'bg-green-500' : 'bg-gray-300'}`} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'ayarlar' && (
        <div className="space-y-4">
          {kaydetMesaj && (
            <div className={`rounded-lg border p-3 text-sm ${kaydetMesaj.startsWith('Hata') ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'}`}>
              {kaydetMesaj}
            </div>
          )}

          <div className="rounded-lg border bg-white p-4">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-medium">Telegram Bot Ayarlari</h3>
              <div className="flex items-center gap-2">
                <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${durum.bot_aktif ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {durum.bot_aktif ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                  {durum.bot_aktif ? 'Bot Aktif' : 'Bot Pasif'}
                </span>
                <button
                  onClick={handleBotRestart}
                  disabled={botYenidenBaslat}
                  className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
                >
                  <RotateCw className={`h-3 w-3 ${botYenidenBaslat ? 'animate-spin' : ''}`} />
                  Yeniden Baslat
                </button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">Bot Token</label>
                <input
                  type="password"
                  placeholder={aiAyar.telegram_bot_token || 'BotFather\'dan aldiginiz token\'i giriniz...'}
                  onChange={(e) => setBotAyarForm(f => ({ ...f, telegram_bot_token: e.target.value }))}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
                <p className="mt-1 text-xs text-gray-400">Telegram'da @BotFather'a /newbot yazarak token alin</p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Bot Kullanici Adi</label>
                <input
                  type="text"
                  placeholder={aiAyar.telegram_bot_username || '@bot_kullanici_adi'}
                  onChange={(e) => setBotAyarForm(f => ({ ...f, telegram_bot_username: e.target.value }))}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Koordinator Chat ID</label>
                <input
                  type="text"
                  placeholder={aiAyar.koordinator_chat_id || 'Bildirim gonderilecek Telegram ID'}
                  onChange={(e) => setBotAyarForm(f => ({ ...f, koordinator_chat_id: e.target.value }))}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
                <p className="mt-1 text-xs text-gray-400">Bota /start yazarak kendi Telegram ID'nizi ogrenebilirsiniz</p>
              </div>
            </div>

            <button
              onClick={handleBotAyarKaydet}
              disabled={Object.keys(botAyarForm).length === 0}
              className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              Kaydet
            </button>
          </div>

          <div className="rounded-lg border bg-blue-50 p-4">
            <h4 className="mb-2 text-sm font-medium text-blue-800">Telegram Bot Kurulum Adimlari</h4>
            <ol className="space-y-1 text-sm text-blue-700">
              <li>1. Telegram'da <strong>@BotFather</strong>'a gidin</li>
              <li>2. <strong>/newbot</strong> komutunu gonderin</li>
              <li>3. Bot icin bir isim verin (ornek: ElektraTrack Bot)</li>
              <li>4. Bot icin bir kullanici adi verin (ornek: elektratrack_bot)</li>
              <li>5. Size verilen <strong>token</strong>'i yukaridaki alana yapisttirin</li>
              <li>6. <strong>Kaydet</strong> butonuna basin</li>
              <li>7. <strong>Yeniden Baslat</strong> butonuna basin</li>
            </ol>
          </div>
        </div>
      )}

      {tab === 'kullanicilar' && (
        <div className="rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-4 py-2.5 text-left font-medium">Telegram ID</th>
                <th className="px-4 py-2.5 text-left font-medium">Kullanici Adi</th>
                <th className="px-4 py-2.5 text-left font-medium">Personel</th>
                <th className="px-4 py-2.5 text-left font-medium">Ekip</th>
                <th className="px-4 py-2.5 text-left font-medium">Son Mesaj</th>
              </tr>
            </thead>
            <tbody>
              {kullanicilar.map((k) => (
                <tr key={k.id} className="border-b">
                  <td className="px-4 py-2">{k.telegram_id}</td>
                  <td className="px-4 py-2">{k.telegram_kullanici_adi || '-'}</td>
                  <td className="px-4 py-2">{k.ad_soyad || '-'}</td>
                  <td className="px-4 py-2">{k.ekip_adi || '-'}</td>
                  <td className="px-4 py-2 text-gray-500">{k.son_mesaj_tarihi || '-'}</td>
                </tr>
              ))}
              {kullanicilar.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-gray-400">Kayitli kullanici yok</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'mesajlar' && (
        <div className="rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-4 py-2.5 text-left font-medium">Tarih</th>
                <th className="px-4 py-2.5 text-left font-medium">Tip</th>
                <th className="px-4 py-2.5 text-left font-medium">Yon</th>
                <th className="px-4 py-2.5 text-left font-medium">Mesaj</th>
                <th className="px-4 py-2.5 text-left font-medium">Durum</th>
                <th className="px-4 py-2.5 text-left font-medium">Sure</th>
              </tr>
            </thead>
            <tbody>
              {mesajlar.map((m) => (
                <tr key={m.id} className="border-b">
                  <td className="px-4 py-2 text-xs">{m.tarih}</td>
                  <td className="px-4 py-2">{m.mesaj_tipi}</td>
                  <td className="px-4 py-2">{m.yon}</td>
                  <td className="max-w-xs truncate px-4 py-2">{m.ham_mesaj?.substring(0, 60)}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${m.islem_durumu === 'islendi' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {m.islem_durumu}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs">{m.islem_suresi_ms ? `${m.islem_suresi_ms}ms` : '-'}</td>
                </tr>
              ))}
              {mesajlar.length === 0 && (
                <tr><td colSpan={6} className="py-6 text-center text-gray-400">Mesaj logu bos</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'ai' && (
        <div className="space-y-4">
          <div className="rounded-lg border bg-white p-4">
            <h3 className="mb-3 font-medium">AI Ayarlari</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-gray-600">Ollama Adresi</label>
                <input
                  type="text"
                  defaultValue={aiAyar.ollama_base_url || 'http://localhost:11434'}
                  onChange={(e) => setAyarForm(f => ({ ...f, ollama_base_url: e.target.value }))}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">Metin Modeli</label>
                <input
                  type="text"
                  defaultValue={aiAyar.ollama_text_model || 'qwen2.5:7b'}
                  onChange={(e) => setAyarForm(f => ({ ...f, ollama_text_model: e.target.value }))}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">Vision Modeli</label>
                <input
                  type="text"
                  defaultValue={aiAyar.ollama_vision_model || 'llama3.2-vision:11b'}
                  onChange={(e) => setAyarForm(f => ({ ...f, ollama_vision_model: e.target.value }))}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">Cloud Provider</label>
                <select
                  defaultValue={aiAyar.cloud_ai_provider || 'claude'}
                  onChange={(e) => setAyarForm(f => ({ ...f, cloud_ai_provider: e.target.value }))}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                >
                  <option value="claude">Claude (Anthropic)</option>
                  <option value="openai">OpenAI (GPT-4o)</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm text-gray-600">Claude API Key</label>
                <input
                  type="password"
                  placeholder={aiAyar.claude_api_key || 'API Key giriniz...'}
                  onChange={(e) => setAyarForm(f => ({ ...f, claude_api_key: e.target.value }))}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
            </div>
            <button
              onClick={() => aiAyarKaydet.mutate(ayarForm)}
              className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
            >
              Kaydet
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
