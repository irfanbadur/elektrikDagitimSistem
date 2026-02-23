import { Routes, Route } from 'react-router-dom'
import MainLayout from '@/components/layout/MainLayout'
import OrganizasyonSemasi from '@/components/organizasyon/OrganizasyonSemasi'

export default function OrganizasyonPage() {
  return (
    <MainLayout title="Organizasyon">
      <Routes>
        <Route index element={<OrganizasyonSemasi />} />
      </Routes>
    </MainLayout>
  )
}
