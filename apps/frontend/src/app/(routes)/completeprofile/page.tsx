'use client'
import AddVetProfile from '@/app/Pages/AddVetProfile/AddVetProfile'
import CompleteProfile from '@/app/Pages/CompleteProfile/CompleteProfile'
import { useOldAuthStore } from '@/app/stores/oldAuthStore'
import React from 'react'

function Page() {
  const type = useOldAuthStore((state) => state.userType)
  const loading = useOldAuthStore((state) => !state.userType) // Add your own loading logic if needed

  if (loading) return <p>Loading profile...</p>

  return ["veterinaryBusiness", "breedingFacility", "petSitter", "groomerShop"].includes(type as string)? <CompleteProfile /> : <AddVetProfile />
}

export default Page
