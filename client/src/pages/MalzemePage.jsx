import { Routes, Route } from 'react-router-dom'
import MainLayout from '@/components/layout/MainLayout'
import StokListesi from '@/components/malzeme/StokListesi'
import MalzemeHareketleri from '@/components/malzeme/MalzemeHareketleri'
import MalzemeForm from '@/components/malzeme/MalzemeForm'

export default function MalzemePage() {
  return (
    <MainLayout title="Malzeme">
      <Routes>
        <Route index element={<StokListesi />} />
        <Route path="yeni" element={<MalzemeForm />} />
        <Route path="hareketler" element={<MalzemeHareketleri />} />
        <Route path=":id" element={<StokListesi />} />
        <Route path=":id/duzenle" element={<MalzemeForm />} />
      </Routes>
    </MainLayout>
  )
}
