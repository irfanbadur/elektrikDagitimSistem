import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const AuthContext = createContext(null)

// ─── TOKEN YÖNETİMİ ──────────────────────────────
function tokenKaydet(token) {
  localStorage.setItem('token', token)
}

function tokenGetir() {
  return localStorage.getItem('token')
}

function tokenSil() {
  localStorage.removeItem('token')
  localStorage.removeItem('kullanici')
}

function kullaniciKaydet(k) {
  localStorage.setItem('kullanici', JSON.stringify(k))
}

function kullaniciGetir() {
  try {
    return JSON.parse(localStorage.getItem('kullanici'))
  } catch {
    return null
  }
}

// ─── TOKEN SÜRE KONTROLÜ ──────────────────────────
function tokenSuresiDolduMu(token) {
  if (!token) return true
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.exp * 1000 < Date.now() + 5 * 60 * 1000
  } catch {
    return true
  }
}

// ═══════════════════════════════════════════════════
// AUTH PROVIDER
// ═══════════════════════════════════════════════════
export function AuthProvider({ children }) {
  const [kullanici, setKullanici] = useState(kullaniciGetir)
  const [yukleniyor, setYukleniyor] = useState(true)

  useEffect(() => {
    const tokenDogrula = async () => {
      const token = tokenGetir()

      if (!token || tokenSuresiDolduMu(token)) {
        setKullanici(null)
        tokenSil()
        setYukleniyor(false)
        return
      }

      try {
        const res = await fetch('/api/auth/profil', {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (res.ok) {
          const json = await res.json()
          if (json.success) {
            setKullanici(json.data.kullanici)
            kullaniciKaydet(json.data.kullanici)
          } else {
            setKullanici(null)
            tokenSil()
          }
        } else {
          setKullanici(null)
          tokenSil()
        }
      } catch {
        // Ağ hatası — mevcut localStorage verisini kullan
      } finally {
        setYukleniyor(false)
      }
    }

    tokenDogrula()
  }, [])

  // ─── GİRİŞ ─────────────────────────────────────
  const girisYap = useCallback(async (kullaniciAdi, sifre) => {
    const res = await fetch('/api/auth/giris', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kullanici_adi: kullaniciAdi, sifre }),
    })

    const json = await res.json()

    if (!json.success) {
      throw new Error(json.error || 'Giriş başarısız')
    }

    tokenKaydet(json.data.token)
    kullaniciKaydet(json.data.kullanici)
    setKullanici(json.data.kullanici)

    return json.data.kullanici
  }, [])

  // ─── ÇIKIŞ ─────────────────────────────────────
  const cikisYap = useCallback(() => {
    tokenSil()
    setKullanici(null)
    window.location.href = '/giris'
  }, [])

  // ─── ŞİFRE DEĞİŞTİRME ─────────────────────────
  const sifreDegistir = useCallback(async (mevcutSifre, yeniSifre) => {
    const token = tokenGetir()
    const res = await fetch('/api/auth/sifre-degistir', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ mevcut_sifre: mevcutSifre, yeni_sifre: yeniSifre }),
    })

    const json = await res.json()
    if (!json.success) throw new Error(json.error)
    return true
  }, [])

  // ─── İZİN KONTROL ──────────────────────────────
  const izinVar = useCallback((modul, aksiyon) => {
    if (!kullanici?.izinler) return false
    const modulIzinleri = kullanici.izinler[modul]
    if (!modulIzinleri) return false
    return !!(modulIzinleri[aksiyon] || modulIzinleri['tam'])
  }, [kullanici])

  const izinKapsam = useCallback((modul, aksiyon) => {
    if (!kullanici?.izinler) return null
    const modulIzinleri = kullanici.izinler[modul]
    if (!modulIzinleri) return null
    return modulIzinleri[aksiyon] || modulIzinleri['tam'] || null
  }, [kullanici])

  const deger = {
    kullanici,
    yukleniyor,
    girisYapildi: !!kullanici,
    girisYap,
    cikisYap,
    sifreDegistir,
    izinVar,
    izinKapsam,
  }

  return (
    <AuthContext.Provider value={deger}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth, AuthProvider içinde kullanılmalı')
  return ctx
}
