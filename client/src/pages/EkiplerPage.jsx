import { Routes, Route } from 'react-router-dom'
import MainLayout from '@/components/layout/MainLayout'
import EkipListesi from '@/components/ekipler/EkipListesi'
import EkipDetay from '@/components/ekipler/EkipDetay'
import EkipForm from '@/components/ekipler/EkipForm'

export default function EkiplerPage() {
  return (
    <MainLayout title="Ekipler">
      <Routes>
        <Route index element={<EkipListesi />} />
        <Route path="yeni" element={<EkipForm />} />
        <Route path=":id" element={<EkipDetay />} />
        <Route path=":id/duzenle" element={<EkipForm />} />
      </Routes>
    </MainLayout>
  )
}
