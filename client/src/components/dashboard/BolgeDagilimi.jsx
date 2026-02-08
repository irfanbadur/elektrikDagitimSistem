import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { BarChart3 } from 'lucide-react'

const RENK_PALETI = ['#2563eb', '#16a34a', '#ea580c', '#8b5cf6', '#06b6d4', '#f59e0b', '#ef4444', '#ec4899']

export default function BolgeDagilimi({ projeler }) {
  // Calculate distribution from projects data
  const bolgeDagilimi = {}
  const durumDagilimi = {}
  const tipDagilimi = {}

  if (projeler && projeler.length > 0) {
    projeler.forEach(p => {
      const bolge = p.bolge_adi || 'Belirsiz'
      bolgeDagilimi[bolge] = (bolgeDagilimi[bolge] || 0) + 1

      const durum = p.durum || 'belirsiz'
      durumDagilimi[durum] = (durumDagilimi[durum] || 0) + 1

      const tip = p.proje_tipi || 'Diğer'
      tipDagilimi[tip] = (tipDagilimi[tip] || 0) + 1
    })
  }

  const barData = Object.entries(bolgeDagilimi).map(([name, value]) => ({ name, value }))
  const pieData = Object.entries(tipDagilimi).map(([name, value]) => ({ name, value }))

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h3 className="mb-4 text-lg font-semibold flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-muted-foreground" />
        Proje Dağılımı
      </h3>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-2 text-sm font-medium text-muted-foreground">Bölge Bazlı</h4>
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} name="Proje" />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground">Veri yok</p>}
        </div>
        <div>
          <h4 className="mb-2 text-sm font-medium text-muted-foreground">Tip Bazlı</h4>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {pieData.map((_, i) => <Cell key={i} fill={RENK_PALETI[i % RENK_PALETI.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground">Veri yok</p>}
        </div>
      </div>
    </div>
  )
}
