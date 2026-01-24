import React, { Suspense } from "react";

import SignUp from "@/app/pages/SignUp/SignUp";

function Page() {
  return (
    <Suspense fallback={null}>
      <SignUp
        postAuthRedirect="/developers/home"
        signinHref="/developers/signin"
        allowNext={false}
        isDeveloper
      />
    </Suspense>
  );
}

export default Page;
