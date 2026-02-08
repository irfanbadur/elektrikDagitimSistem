import { Routes, Route } from 'react-router-dom'
import MainLayout from '@/components/layout/MainLayout'
import PuantajTablosu from '@/components/puantaj/PuantajTablosu'
import PuantajForm from '@/components/puantaj/PuantajForm'
import GunlukRapor from '@/components/puantaj/GunlukRapor'

export default function PuantajPage() {
  return (
    <MainLayout title="Puantaj">
      <Routes>
        <Route index element={<PuantajTablosu />} />
        <Route path="yeni" element={<PuantajForm />} />
        <Route path=":id" element={<GunlukRapor />} />
        <Route path=":id/duzenle" element={<PuantajForm />} />
      </Routes>
    </MainLayout>
  )
}
