"use client";
import React, { useEffect } from "react";
import "./BookDemo.css";
import Cal, { getCalApi } from "@calcom/embed-react";

function BookDemo() {
  useEffect(() => {
    (async function () {
      const cal = await getCalApi({ namespace: "30min" });
      cal("ui", { hideEventTypeDetails: false, layout: "month_view" });
    })();
  }, []);
  return (
    <div className="App">
        {/* <Cal calLink="rick/get-rick-rolled" config={{ theme: "light" }}></Cal> */}
        <Cal
          namespace="30min"
          calLink="yosemitecrew/30min"
          style={{width:"100%",height:"100%",overflow:"scroll"}}
          config={{ theme: "light", "layout":"month_view" }}
        />
    </div>
  );
}

export default BookDemo;
