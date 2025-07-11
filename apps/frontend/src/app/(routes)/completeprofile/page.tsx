'use client'
import AddVetProfile from '@/app/Pages/AddVetProfile/AddVetProfile'
import CompleteProfile from '@/app/Pages/CompleteProfile/CompleteProfile'
import { useAuthStore } from '@/app/stores/authStore'
import React from 'react'

function Page() {
  const type = useAuthStore((state) => state.userType)
  const loading = useAuthStore((state) => !state.userType) // Add your own loading logic if needed

  if (loading) return <p>Loading profile...</p>

  return type === 'Veterinary Business' ? <CompleteProfile /> : <AddVetProfile />
}

export default Page
