# ElektraTrack — Oturum Yönetimi ve Login Sistemi (Frontend)

## Amaç

Kullanıcıların sisteme giriş yapabilmesi, kimin giriş yaptığının görünmesi ve yetkisiz erişimin engellenmesi.

**Bu MD şunları kapsar:**
1. Login sayfası (kullanıcı adı + şifre)
2. Auth Context (React oturum yönetimi)
3. Korumalı route'lar (giriş yapmadan sayfa açılamaz)
4. Header'da kullanıcı profil göstergesi (ad, rol, avatar, çıkış)
5. Token yenileme ve oturum süresi
6. Şifre değiştirme modalı

**Ön koşul:** `elektratrack-kullanici-rolleri.md`'deki backend auth API'leri (JWT, login endpoint, middleware) hazır olmalı.

---

## Adım 1 — Auth Context

Tüm uygulamada oturum bilgisini paylaşan React context.

### `client/src/context/AuthContext.jsx`

```jsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

// ─── TOKEN YÖNETİMİ ──────────────────────────────
function tokenKaydet(token) {
  localStorage.setItem('token', token);
}

function tokenGetir() {
  return localStorage.getItem('token');
}

function tokenSil() {
  localStorage.removeItem('token');
  localStorage.removeItem('kullanici');
}

function kullaniciKaydet(kullanici) {
  localStorage.setItem('kullanici', JSON.stringify(kullanici));
}

function kullaniciGetir() {
  try {
    return JSON.parse(localStorage.getItem('kullanici'));
  } catch {
    return null;
  }
}

// ─── TOKEN SÜRE KONTROLÜ ──────────────────────────
function tokenSuresiDolduMu(token) {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    // 5 dakika erken expire say (yenileme için margin)
    return payload.exp * 1000 < Date.now() + 5 * 60 * 1000;
  } catch {
    return true;
  }
}

// ─── API HELPER ───────────────────────────────────
// Token'ı otomatik ekleyen fetch wrapper
async function authFetch(url, options = {}) {
  const token = tokenGetir();

  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  // 401 gelirse oturumu sonlandır
  if (res.status === 401) {
    tokenSil();
    window.location.href = '/giris';
    throw new Error('Oturum süresi doldu');
  }

  return res;
}

// ═══════════════════════════════════════════════════
// AUTH PROVIDER
// ═══════════════════════════════════════════════════
export function AuthProvider({ children }) {
  const [kullanici, setKullanici] = useState(kullaniciGetir);
  const [yukleniyor, setYukleniyor] = useState(true);

  // Sayfa yüklendiğinde mevcut token'ı doğrula
  useEffect(() => {
    const tokenDogrula = async () => {
      const token = tokenGetir();

      if (!token || tokenSuresiDolduMu(token)) {
        setKullanici(null);
        tokenSil();
        setYukleniyor(false);
        return;
      }

      try {
        const res = await fetch('/api/auth/profil', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const json = await res.json();
          if (json.success) {
            setKullanici(json.data.kullanici);
            kullaniciKaydet(json.data.kullanici);
          } else {
            setKullanici(null);
            tokenSil();
          }
        } else {
          setKullanici(null);
          tokenSil();
        }
      } catch {
        // Ağ hatası — mevcut localStorage verisini kullan
        // (offline durumda en azından sayfa açılsın)
      } finally {
        setYukleniyor(false);
      }
    };

    tokenDogrula();
  }, []);

  // ─── GİRİŞ ─────────────────────────────────────
  const girisYap = useCallback(async (kullaniciAdi, sifre) => {
    const res = await fetch('/api/auth/giris', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kullanici_adi: kullaniciAdi, sifre }),
    });

    const json = await res.json();

    if (!json.success) {
      throw new Error(json.error || 'Giriş başarısız');
    }

    tokenKaydet(json.data.token);
    kullaniciKaydet(json.data.kullanici);
    setKullanici(json.data.kullanici);

    return json.data.kullanici;
  }, []);

  // ─── ÇIKIŞ ─────────────────────────────────────
  const cikisYap = useCallback(() => {
    tokenSil();
    setKullanici(null);
    window.location.href = '/giris';
  }, []);

  // ─── ŞİFRE DEĞİŞTİRME ─────────────────────────
  const sifreDegistir = useCallback(async (mevcutSifre, yeniSifre) => {
    const res = await authFetch('/api/auth/sifre-degistir', {
      method: 'PUT',
      body: JSON.stringify({ mevcut_sifre: mevcutSifre, yeni_sifre: yeniSifre }),
    });

    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    return true;
  }, []);

  // ─── İZİN KONTROL ──────────────────────────────
  const izinVar = useCallback((modul, aksiyon) => {
    if (!kullanici?.izinler) return false;
    const modulIzinleri = kullanici.izinler[modul];
    if (!modulIzinleri) return false;
    return !!(modulIzinleri[aksiyon] || modulIzinleri['tam']);
  }, [kullanici]);

  const izinKapsam = useCallback((modul, aksiyon) => {
    if (!kullanici?.izinler) return null;
    const modulIzinleri = kullanici.izinler[modul];
    if (!modulIzinleri) return null;
    return modulIzinleri[aksiyon] || modulIzinleri['tam'] || null;
  }, [kullanici]);

  const deger = {
    kullanici,
    yukleniyor,
    girisYapildi: !!kullanici,
    girisYap,
    cikisYap,
    sifreDegistir,
    izinVar,
    izinKapsam,
    authFetch,   // Token'lı fetch — tüm API isteklerinde kullan
  };

  return (
    <AuthContext.Provider value={deger}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth, AuthProvider içinde kullanılmalı');
  return ctx;
}

export { authFetch };
```

---

## Adım 2 — Login Sayfası

### `client/src/pages/LoginPage.jsx`

```jsx
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const { girisYap } = useAuth();
  const navigate = useNavigate();

  const [kullaniciAdi, setKullaniciAdi] = useState('');
  const [sifre, setSifre] = useState('');
  const [hata, setHata] = useState('');
  const [yukleniyor, setYukleniyor] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setHata('');
    setYukleniyor(true);

    try {
      await girisYap(kullaniciAdi, sifre);
      navigate('/');
    } catch (err) {
      setHata(err.message);
    } finally {
      setYukleniyor(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #1e3a5f 0%, #1e40af 50%, #3b82f6 100%)',
      padding: '20px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '400px',
        background: 'white',
        borderRadius: '16px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        overflow: 'hidden',
      }}>

        {/* ─── BAŞLIK ──────────────────────────── */}
        <div style={{
          background: '#1e40af',
          padding: '32px 24px 24px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '40px', marginBottom: '8px' }}>⚡</div>
          <h1 style={{
            margin: 0,
            color: 'white',
            fontSize: '24px',
            fontWeight: 700,
            letterSpacing: '0.5px',
          }}>
            ElektraTrack
          </h1>
          <p style={{
            margin: '6px 0 0',
            color: '#93c5fd',
            fontSize: '13px',
          }}>
            Elektrik Dağıtım Proje Takip Sistemi
          </p>
        </div>

        {/* ─── FORM ────────────────────────────── */}
        <form onSubmit={handleSubmit} style={{ padding: '28px 24px' }}>

          {/* Hata mesajı */}
          {hata && (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              ⚠️ {hata}
            </div>
          )}

          {/* Kullanıcı Adı */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 600,
              color: '#374151',
              marginBottom: '6px',
            }}>
              Kullanıcı Adı
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute', left: '12px', top: '50%',
                transform: 'translateY(-50%)', fontSize: '16px', color: '#9ca3af',
              }}>👤</span>
              <input
                type="text"
                value={kullaniciAdi}
                onChange={(e) => setKullaniciAdi(e.target.value)}
                placeholder="Kullanıcı adınız"
                autoComplete="username"
                autoFocus
                required
                style={{
                  width: '100%',
                  padding: '12px 12px 12px 40px',
                  border: '1px solid #d1d5db',
                  borderRadius: '10px',
                  fontSize: '15px',
                  outline: 'none',
                  transition: 'border 0.2s',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
              />
            </div>
          </div>

          {/* Şifre */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 600,
              color: '#374151',
              marginBottom: '6px',
            }}>
              Şifre
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute', left: '12px', top: '50%',
                transform: 'translateY(-50%)', fontSize: '16px', color: '#9ca3af',
              }}>🔒</span>
              <input
                type="password"
                value={sifre}
                onChange={(e) => setSifre(e.target.value)}
                placeholder="Şifreniz"
                autoComplete="current-password"
                required
                style={{
                  width: '100%',
                  padding: '12px 12px 12px 40px',
                  border: '1px solid #d1d5db',
                  borderRadius: '10px',
                  fontSize: '15px',
                  outline: 'none',
                  transition: 'border 0.2s',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
              />
            </div>
          </div>

          {/* Giriş Butonu */}
          <button
            type="submit"
            disabled={yukleniyor || !kullaniciAdi || !sifre}
            style={{
              width: '100%',
              padding: '13px',
              background: yukleniyor ? '#93c5fd' : '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '15px',
              fontWeight: 600,
              cursor: yukleniyor ? 'wait' : 'pointer',
              transition: 'background 0.2s',
            }}
          >
            {yukleniyor ? '⏳ Giriş yapılıyor...' : 'Giriş Yap'}
          </button>
        </form>

        {/* ─── ALT BİLGİ ──────────────────────── */}
        <div style={{
          padding: '0 24px 20px',
          textAlign: 'center',
          fontSize: '11px',
          color: '#9ca3af',
        }}>
          ElektraTrack v1.0 • {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}
```

---

## Adım 3 — Header Kullanıcı Profil Göstergesi

Uygulamanın üst bar'ında kimin giriş yaptığını gösteren bileşen.

### `client/src/components/HeaderKullaniciMenu.jsx`

```jsx
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function HeaderKullaniciMenu() {
  const { kullanici, cikisYap } = useAuth();
  const [menuAcik, setMenuAcik] = useState(false);
  const menuRef = useRef(null);

  // Dışarı tıklayınca menüyü kapat
  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuAcik(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (!kullanici) return null;

  // İlk rollün bilgisi
  const birincilRol = kullanici.roller?.[0];

  // Ad soyadından baş harfler
  const basHarfler = kullanici.ad_soyad
    .split(' ')
    .map(s => s[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>

      {/* ─── PROFIL BUTONU ─────────────────────── */}
      <button
        onClick={() => setMenuAcik(!menuAcik)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '6px 12px 6px 6px',
          background: menuAcik ? '#f3f4f6' : 'transparent',
          border: '1px solid transparent',
          borderRadius: '10px',
          cursor: 'pointer',
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => { if (!menuAcik) e.currentTarget.style.background = '#f9fafb'; }}
        onMouseLeave={(e) => { if (!menuAcik) e.currentTarget.style.background = 'transparent'; }}
      >
        {/* Avatar dairesi */}
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          background: birincilRol?.renk || '#2563eb',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '13px',
          fontWeight: 700,
          flexShrink: 0,
        }}>
          {basHarfler}
        </div>

        {/* İsim ve rol (masaüstünde görünür, mobilde gizli) */}
        <div className="header-kullanici-bilgi" style={{
          textAlign: 'left',
          lineHeight: 1.2,
        }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#1f2937' }}>
            {kullanici.ad_soyad}
          </div>
          <div style={{
            fontSize: '11px',
            color: birincilRol?.renk || '#6b7280',
            fontWeight: 500,
          }}>
            {birincilRol?.ikon} {birincilRol?.adi || 'Kullanıcı'}
          </div>
        </div>

        {/* Ok ikonu */}
        <span style={{
          fontSize: '10px',
          color: '#9ca3af',
          transform: menuAcik ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.15s',
        }}>
          ▼
        </span>
      </button>

      {/* ─── DROPDOWN MENÜ ─────────────────────── */}
      {menuAcik && (
        <div style={{
          position: 'absolute',
          right: 0,
          top: 'calc(100% + 6px)',
          width: '260px',
          background: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '12px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
          zIndex: 1000,
          overflow: 'hidden',
        }}>
          {/* Kullanıcı bilgisi */}
          <div style={{
            padding: '16px',
            borderBottom: '1px solid #f3f4f6',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '44px', height: '44px', borderRadius: '50%',
                background: birincilRol?.renk || '#2563eb',
                color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '16px', fontWeight: 700,
              }}>
                {basHarfler}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '14px', color: '#1f2937' }}>
                  {kullanici.ad_soyad}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                  {kullanici.kullanici_adi}
                </div>
                {/* Tüm roller */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                  {kullanici.roller?.map(rol => (
                    <span key={rol.id} style={{
                      fontSize: '10px',
                      fontWeight: 600,
                      padding: '2px 6px',
                      borderRadius: '6px',
                      background: `${rol.renk}15`,
                      color: rol.renk,
                      border: `1px solid ${rol.renk}30`,
                    }}>
                      {rol.ikon} {rol.adi}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Menü öğeleri */}
          <div style={{ padding: '6px' }}>
            <MenuOge
              ikon="👤"
              etiket="Profilim"
              onClick={() => { setMenuAcik(false); window.location.href = '/profil'; }}
            />
            <MenuOge
              ikon="🔒"
              etiket="Şifre Değiştir"
              onClick={() => { setMenuAcik(false); window.location.href = '/sifre-degistir'; }}
            />
          </div>

          {/* Çıkış */}
          <div style={{
            padding: '6px',
            borderTop: '1px solid #f3f4f6',
          }}>
            <MenuOge
              ikon="🚪"
              etiket="Çıkış Yap"
              tehlikeli
              onClick={() => {
                setMenuAcik(false);
                cikisYap();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Dropdown menü öğesi
function MenuOge({ ikon, etiket, onClick, tehlikeli = false }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        width: '100%',
        padding: '10px 12px',
        border: 'none',
        background: 'transparent',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '13px',
        color: tehlikeli ? '#dc2626' : '#374151',
        fontWeight: tehlikeli ? 600 : 400,
        textAlign: 'left',
        transition: 'background 0.1s',
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = tehlikeli ? '#fef2f2' : '#f9fafb'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
      <span style={{ fontSize: '16px' }}>{ikon}</span>
      {etiket}
    </button>
  );
}
```

---

## Adım 4 — Korumalı Route (ProtectedRoute)

Giriş yapmamış kullanıcıları login'e yönlendirir.

### `client/src/components/ProtectedRoute.jsx`

```jsx
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Korumalı route wrapper
 *
 * Kullanım:
 *   <Route path="/projeler" element={
 *     <ProtectedRoute modul="projeler" aksiyon="okuma">
 *       <ProjelerPage />
 *     </ProtectedRoute>
 *   } />
 */
export default function ProtectedRoute({ children, modul, aksiyon }) {
  const { girisYapildi, yukleniyor, izinVar } = useAuth();
  const location = useLocation();

  // Yükleniyor — splash göster
  if (yukleniyor) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '12px',
        color: '#6b7280',
      }}>
        <div style={{ fontSize: '40px' }}>⚡</div>
        <div style={{ fontSize: '14px' }}>Yükleniyor...</div>
      </div>
    );
  }

  // Giriş yapılmamış → Login'e yönlendir
  if (!girisYapildi) {
    return <Navigate to="/giris" state={{ from: location }} replace />;
  }

  // Modül/aksiyon belirtilmişse izin kontrolü
  if (modul && aksiyon && !izinVar(modul, aksiyon)) {
    return (
      <div style={{
        height: '80vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '12px',
        color: '#6b7280',
      }}>
        <div style={{ fontSize: '60px' }}>🚫</div>
        <h2 style={{ margin: 0, color: '#374151' }}>Erişim Engellendi</h2>
        <p>Bu sayfayı görüntülemek için yetkiniz yok.</p>
        <a href="/" style={{ color: '#2563eb', fontSize: '14px' }}>Ana sayfaya dön</a>
      </div>
    );
  }

  return children;
}
```

---

## Adım 5 — App.jsx Entegrasyonu

### `client/src/App.jsx`

```jsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

// Sayfalar
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ProjelerPage from './pages/ProjelerPage';
import EkiplerPage from './pages/EkiplerPage';
import SahaMesajPage from './pages/SahaMesajPage';
import AyarlarPage from './pages/AyarlarPage';
// ... diğer sayfalar

// Layout
import AppLayout from './components/AppLayout';

function AppRoutes() {
  const { girisYapildi } = useAuth();

  return (
    <Routes>
      {/* ─── PUBLIC — Login ──────────────────── */}
      <Route
        path="/giris"
        element={girisYapildi ? <Navigate to="/" replace /> : <LoginPage />}
      />

      {/* ─── PROTECTED — Uygulama ────────────── */}
      <Route element={
        <ProtectedRoute>
          <AppLayout />
        </ProtectedRoute>
      }>
        {/* Dashboard — herkes görebilir */}
        <Route path="/" element={<DashboardPage />} />

        {/* Projeler */}
        <Route path="/projeler" element={
          <ProtectedRoute modul="projeler" aksiyon="okuma">
            <ProjelerPage />
          </ProtectedRoute>
        } />

        {/* Ekipler */}
        <Route path="/ekipler" element={
          <ProtectedRoute modul="ekipler" aksiyon="okuma">
            <EkiplerPage />
          </ProtectedRoute>
        } />

        {/* Saha Mesaj */}
        <Route path="/saha-mesaj" element={
          <ProtectedRoute modul="saha_mesaj" aksiyon="yazma">
            <SahaMesajPage />
          </ProtectedRoute>
        } />

        {/* Ayarlar */}
        <Route path="/ayarlar" element={
          <ProtectedRoute modul="ayarlar" aksiyon="genel">
            <AyarlarPage />
          </ProtectedRoute>
        } />

        {/* ... diğer route'lar aynı pattern ... */}
      </Route>

      {/* 404 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
```

---

## Adım 6 — AppLayout (Sidebar + Header + İçerik)

Header'da kullanıcı profilini, sidebar'da yetkili menüleri gösteren layout.

### `client/src/components/AppLayout.jsx`

```jsx
import React, { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import HeaderKullaniciMenu from './HeaderKullaniciMenu';

// ─── MENÜ TANIMLARI ─────────────────────────────
const MENU_ITEMS = [
  { label: 'Dashboard',       path: '/',              icon: '🏠',  herZaman: true },
  { label: 'Projeler',        path: '/projeler',      icon: '📁',  modul: 'projeler',     aksiyon: 'okuma' },
  { label: 'Ekipler',         path: '/ekipler',       icon: '👥',  modul: 'ekipler',      aksiyon: 'okuma' },
  { label: 'Personel',        path: '/personel',      icon: '👤',  modul: 'personel',     aksiyon: 'okuma' },
  { label: 'Veri Paketleri',  path: '/veri-paketi',   icon: '📦',  modul: 'veri_paketi',  aksiyon: 'okuma' },
  { label: 'Saha Harita',     path: '/saha',          icon: '🗺️',  modul: 'saha_harita',  aksiyon: 'okuma' },
  { label: 'Saha Mesaj',      path: '/saha-mesaj',    icon: '💬',  modul: 'saha_mesaj',   aksiyon: 'yazma' },
  { label: 'Malzeme/Depo',    path: '/malzeme',       icon: '🏪',  modul: 'malzeme',      aksiyon: 'okuma' },
  { label: 'Finansal',        path: '/finansal',      icon: '💰',  modul: 'finansal',     aksiyon: 'okuma' },
  { label: 'İSG',             path: '/isg',           icon: '🛡️',  modul: 'isg',          aksiyon: 'okuma' },
  { label: 'Raporlar',        path: '/raporlar',      icon: '📊',  modul: 'raporlar',     aksiyon: 'genel' },
  { label: 'Ayarlar',         path: '/ayarlar',       icon: '⚙️',  modul: 'ayarlar',      aksiyon: 'genel' },
];

export default function AppLayout() {
  const { kullanici, izinVar } = useAuth();
  const [sidebarAcik, setSidebarAcik] = useState(true);

  // Yetkiye göre menü filtrele
  const gorunurMenu = MENU_ITEMS.filter(item =>
    item.herZaman || izinVar(item.modul, item.aksiyon)
  );

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

      {/* ═══ SIDEBAR ═══════════════════════════════ */}
      <aside style={{
        width: sidebarAcik ? '240px' : '60px',
        background: '#111827',
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s',
        flexShrink: 0,
        overflow: 'hidden',
      }}>
        {/* Logo */}
        <div style={{
          padding: '16px',
          borderBottom: '1px solid #1f2937',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          minHeight: '56px',
        }}>
          <span style={{ fontSize: '24px' }}>⚡</span>
          {sidebarAcik && (
            <span style={{ fontSize: '16px', fontWeight: 700, letterSpacing: '0.3px' }}>
              ElektraTrack
            </span>
          )}
        </div>

        {/* Menü öğeleri */}
        <nav style={{ flex: 1, padding: '8px', overflowY: 'auto' }}>
          {gorunurMenu.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                borderRadius: '8px',
                textDecoration: 'none',
                color: isActive ? 'white' : '#9ca3af',
                background: isActive ? '#1f2937' : 'transparent',
                fontSize: '13px',
                fontWeight: isActive ? 600 : 400,
                marginBottom: '2px',
                transition: 'background 0.15s',
                whiteSpace: 'nowrap',
              })}
            >
              <span style={{ fontSize: '18px', width: '24px', textAlign: 'center' }}>
                {item.icon}
              </span>
              {sidebarAcik && item.label}
            </NavLink>
          ))}
        </nav>

        {/* Sidebar toggle */}
        <button
          onClick={() => setSidebarAcik(!sidebarAcik)}
          style={{
            padding: '12px',
            background: 'transparent',
            border: 'none',
            borderTop: '1px solid #1f2937',
            color: '#6b7280',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          {sidebarAcik ? '◀' : '▶'}
        </button>
      </aside>

      {/* ═══ ANA İÇERİK ═══════════════════════════ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* ─── HEADER ─────────────────────────── */}
        <header style={{
          height: '56px',
          background: 'white',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          flexShrink: 0,
        }}>
          {/* Sol — Mobil menü butonu + breadcrumb alanı */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => setSidebarAcik(!sidebarAcik)}
              style={{
                display: 'none',  // Mobilde visible yapılacak (CSS media query)
                background: 'transparent',
                border: 'none',
                fontSize: '20px',
                cursor: 'pointer',
                color: '#6b7280',
              }}
              className="mobil-menu-btn"
            >
              ☰
            </button>
          </div>

          {/* Sağ — Kullanıcı profil menüsü */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <HeaderKullaniciMenu />
          </div>
        </header>

        {/* ─── SAYFA İÇERİĞİ ──────────────────── */}
        <main style={{
          flex: 1,
          overflow: 'auto',
          background: '#f9fafb',
        }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
```

---

## Adım 7 — Mevcut API İsteklerini authFetch'e Geçirme

Tüm mevcut API çağrılarında `fetch` yerine `authFetch` kullanılmalı. Bu şekilde her istekte JWT token otomatik eklenir ve 401 gelirse login'e yönlendirilir.

### Geçiş Kuralı

```jsx
// ─── ESKİ ───────────────────────────────────
const res = await fetch('/api/projeler');

// ─── YENİ ───────────────────────────────────
import { useAuth } from '../context/AuthContext';
// ...
const { authFetch } = useAuth();
const res = await authFetch('/api/projeler');

// ─── veya context dışında (servis dosyalarında) ─
import { authFetch } from '../context/AuthContext';
const res = await authFetch('/api/projeler');
```

### Örnek: ProjelerPage'de Kullanım

```jsx
import { useAuth } from '../context/AuthContext';

export default function ProjelerPage() {
  const { authFetch, izinVar } = useAuth();
  const [projeler, setProjeler] = useState([]);

  useEffect(() => {
    const yukle = async () => {
      const res = await authFetch('/api/projeler');
      const json = await res.json();
      if (json.success) setProjeler(json.data);
    };
    yukle();
  }, []);

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Projeler</h1>
        {/* Yazma yetkisi varsa ekle butonu göster */}
        {izinVar('projeler', 'yazma') && (
          <button>+ Yeni Proje</button>
        )}
      </div>

      {/* Proje listesi ... */}
    </div>
  );
}
```

---

## Beklenen Görünüm

### Login Sayfası

```
┌──────────────────────────────────────────────┐
│         ▒▒▒ Gradient arka plan ▒▒▒          │
│                                              │
│       ┌────────────────────────────┐         │
│       │         ⚡                 │         │
│       │     ElektraTrack           │         │
│       │  Elektrik Dağıtım Proje   │         │
│       │      Takip Sistemi         │         │
│       ├────────────────────────────┤         │
│       │                            │         │
│       │  Kullanıcı Adı             │         │
│       │  ┌──────────────────────┐  │         │
│       │  │ 👤 admin             │  │         │
│       │  └──────────────────────┘  │         │
│       │                            │         │
│       │  Şifre                     │         │
│       │  ┌──────────────────────┐  │         │
│       │  │ 🔒 ••••••            │  │         │
│       │  └──────────────────────┘  │         │
│       │                            │         │
│       │  ┌──────────────────────┐  │         │
│       │  │     Giriş Yap        │  │         │
│       │  └──────────────────────┘  │         │
│       │                            │         │
│       │   ElektraTrack v1.0        │         │
│       └────────────────────────────┘         │
│                                              │
└──────────────────────────────────────────────┘
```

### Giriş Sonrası — Header

```
┌──────────────────────────────────────────────────────────────┐
│ ⚡ ElektraTrack      │                     [İY] İrfan Y. ▼  │
│                       │                      📋 Koordinatör  │
├───────────────────────┤                                      │
│ 🏠 Dashboard          │     (tıklayınca dropdown açılır)     │
│ 📁 Projeler           │     ┌──────────────────────────┐     │
│ 👥 Ekipler            │     │ [İY] İrfan Yılmaz        │     │
│ 👤 Personel           │     │      @irfan               │     │
│ 📦 Veri Paketleri     │     │ 📋 Koordinatör 👑 Patron  │     │
│ 🗺️ Saha Harita        │     ├──────────────────────────┤     │
│ 💬 Saha Mesaj          │     │ 👤 Profilim               │     │
│ 🏪 Malzeme/Depo       │     │ 🔒 Şifre Değiştir         │     │
│ 💰 Finansal            │     ├──────────────────────────┤     │
│ 🛡️ İSG                │     │ 🚪 Çıkış Yap              │     │
│ 📊 Raporlar            │     └──────────────────────────┘     │
│ ⚙️ Ayarlar             │                                      │
│                       │                                      │
│ ◀                     │     [Sayfa İçeriği]                  │
└───────────────────────┴──────────────────────────────────────┘
```

---

## Kontrol Listesi

**Auth Context:**
- [ ] `AuthContext.jsx` oluşturuldu
- [ ] `AuthProvider` App.jsx'i sarmalıyor
- [ ] `useAuth()` hook'u çalışıyor (girisYap, cikisYap, izinVar, authFetch)
- [ ] Token localStorage'da saklanıyor
- [ ] Sayfa yüklendiğinde token doğrulanıyor (`/api/auth/profil`)
- [ ] Token süresi dolmuşsa login'e yönlendiriliyor

**Login Sayfası:**
- [ ] `/giris` route'u çalışıyor
- [ ] Kullanıcı adı + şifre ile giriş yapılıyor
- [ ] Hatalı giriş → hata mesajı gösteriliyor
- [ ] Başarılı giriş → dashboard'a yönlendiriliyor
- [ ] Zaten giriş yapılmışsa → login sayfası dashboard'a redirect ediyor

**Header Profil Menüsü:**
- [ ] Kullanıcı adı ve rolü header'da görünüyor
- [ ] Baş harflerden avatar dairesi oluşuyor
- [ ] Dropdown menü açılıyor (profil, şifre değiştir, çıkış)
- [ ] Çıkış Yap → token silinip login'e yönlendiriliyor
- [ ] Dışarı tıklayınca menü kapanıyor

**Korumalı Route'lar:**
- [ ] Giriş yapmadan herhangi bir sayfaya gidilemiyor
- [ ] Yetkisi olmayan sayfa → "Erişim Engellendi" gösteriliyor
- [ ] Sidebar menüsü yetkiye göre filtreleniyor

**authFetch Geçişi:**
- [ ] En az bir mevcut sayfada `fetch` → `authFetch` geçişi yapıldı
- [ ] 401 geldiğinde otomatik login'e yönlendiriliyor

**Mobil:**
- [ ] Login sayfası mobilde düzgün görünüyor
- [ ] Header profil menüsü mobilde çalışıyor
