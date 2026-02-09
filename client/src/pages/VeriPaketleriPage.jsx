import { Routes, Route } from 'react-router-dom'
import MainLayout from '@/components/layout/MainLayout'
import VeriPaketiListesi from '@/components/veriPaketleri/VeriPaketiListesi'
import VeriPaketiDetay from '@/components/veriPaketleri/VeriPaketiDetay'

export default function VeriPaketleriPage() {
  return (
    <MainLayout>
      <Routes>
        <Route index element={<VeriPaketiListesi />} />
        <Route path=":id" element={<VeriPaketiDetay />} />
      </Routes>
    </MainLayout>
  )
}
