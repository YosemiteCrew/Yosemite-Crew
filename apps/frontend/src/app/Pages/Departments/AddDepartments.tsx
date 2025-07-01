'use client';
import React, { useState } from 'react';
import "./Departments.css"
import Header from '@/app/Components/Header/Header';

function AddDepartments() {
    const [isLoggedIn] = useState(true);
  return (
    <>
    <Header isLoggedIn={isLoggedIn} />




    </>
  )
}

export default AddDepartments