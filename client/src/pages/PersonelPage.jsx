import { Routes, Route } from 'react-router-dom'
import MainLayout from '@/components/layout/MainLayout'
import PersonelListesi from '@/components/personel/PersonelListesi'
import PersonelDetay from '@/components/personel/PersonelDetay'
import PersonelForm from '@/components/personel/PersonelForm'

export default function PersonelPage() {
  return (
    <MainLayout title="Personel">
      <Routes>
        <Route index element={<PersonelListesi />} />
        <Route path="yeni" element={<PersonelForm />} />
        <Route path=":id" element={<PersonelDetay />} />
        <Route path=":id/duzenle" element={<PersonelForm />} />
      </Routes>
    </MainLayout>
  )
}
