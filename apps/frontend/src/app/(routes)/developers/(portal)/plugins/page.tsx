import React from "react";

import "@/app/pages/Organizations/Organizations.css";
import DevRouteGuard from "@/app/components/DevRouteGuard/DevRouteGuard";

function Page() {
  return (
    <DevRouteGuard>
      <div className="OperationsWrapper">
        <div className="TitleContainer">
          <h2>Plugins</h2>
        </div>
        <p className="InviteTitle" style={{ marginBottom: 8 }}>
          Coming soon
        </p>
        <p>Publish, manage, and monitor your plugins here.</p>
      </div>
    </DevRouteGuard>
  );
}

export default Page;
