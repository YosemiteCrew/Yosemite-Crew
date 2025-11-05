import React, { Suspense } from "react";

import SignIn from "@/app/pages/SignIn/SignIn";

function Page() {
  return (
    <Suspense fallback={<div></div>}>
      <SignIn />;
    </Suspense>
  );
}

export default Page;
