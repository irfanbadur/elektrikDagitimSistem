import { Routes, Route } from 'react-router-dom'
import MainLayout from '@/components/layout/MainLayout'
import ProjeListesi from '@/components/projeler/ProjeListesi'
import ProjeDetay from '@/components/projeler/ProjeDetay'
import ProjeForm from '@/components/projeler/ProjeForm'

export default function ProjelerPage() {
  return (
    <Routes>
      <Route index element={<MainLayout title="Projeler"><ProjeListesi /></MainLayout>} />
      <Route path="yeni" element={<MainLayout title="Projeler"><ProjeForm /></MainLayout>} />
      <Route path=":id" element={<MainLayout title="Projeler" noPadding><ProjeDetay /></MainLayout>} />
      <Route path=":id/duzenle" element={<MainLayout title="Projeler"><ProjeForm /></MainLayout>} />
    </Routes>
  )
}
