import React from "react";

import "@/app/pages/Organizations/Organizations.css";
import DevRouteGuard from "@/app/components/DevRouteGuard/DevRouteGuard";

function Page() {
  return (
    <DevRouteGuard>
      <div className="OperationsWrapper">
        <div className="TitleContainer">
          <h2 className="text-heading-1 text-text-primary">Plugins</h2>
        </div>
        <p className="text-heading-2 text-text-primary" style={{ marginBottom: 8 }}>
          Coming soon
        </p>
        <p className="text-body-3 text-text-secondary">Publish, manage, and monitor your plugins here.</p>
      </div>
    </DevRouteGuard>
  );
}

export default Page;
