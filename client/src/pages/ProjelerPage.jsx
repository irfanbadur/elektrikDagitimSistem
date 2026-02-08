import { Routes, Route } from 'react-router-dom'
import MainLayout from '@/components/layout/MainLayout'
import ProjeListesi from '@/components/projeler/ProjeListesi'
import ProjeDetay from '@/components/projeler/ProjeDetay'
import ProjeForm from '@/components/projeler/ProjeForm'

export default function ProjelerPage() {
  return (
    <MainLayout title="Projeler">
      <Routes>
        <Route index element={<ProjeListesi />} />
        <Route path="yeni" element={<ProjeForm />} />
        <Route path=":id" element={<ProjeDetay />} />
        <Route path=":id/duzenle" element={<ProjeForm />} />
      </Routes>
    </MainLayout>
  )
}
