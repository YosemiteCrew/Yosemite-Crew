'use client';
import React, { useEffect } from 'react';
import dynamic from 'next/dynamic';

import './BookDemo.css';

const Cal = dynamic(() => import('@calcom/embed-react'), { ssr: false });

const BookDemo = () => {
  useEffect(() => {
    (async function () {
      const { getCalApi } = await import('@calcom/embed-react');
      const cal = await getCalApi({ namespace: '30min' });
      cal('ui', { hideEventTypeDetails: false, layout: 'month_view' });
    })();
  }, []);

  return (
    <div className="App">
      <Cal
        namespace="30min"
        calLink="yosemitecrew/demo"
        style={{ width: '100%', height: '100%', overflow: 'scroll' }}
        config={{ theme: 'light', layout: 'month_view' }}
      />
    </div>
  );
};

export default BookDemo;
