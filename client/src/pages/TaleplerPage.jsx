import { Routes, Route } from 'react-router-dom'
import MainLayout from '@/components/layout/MainLayout'
import TalepListesi from '@/components/talepler/TalepListesi'
import TalepDetay from '@/components/talepler/TalepDetay'
import TalepForm from '@/components/talepler/TalepForm'

export default function TaleplerPage() {
  return (
    <MainLayout title="Talepler">
      <Routes>
        <Route index element={<TalepListesi />} />
        <Route path="yeni" element={<TalepForm />} />
        <Route path=":id" element={<TalepDetay />} />
        <Route path=":id/duzenle" element={<TalepForm />} />
      </Routes>
    </MainLayout>
  )
}
