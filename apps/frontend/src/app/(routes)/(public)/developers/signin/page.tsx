import React, { Suspense } from "react";

import SignIn from "@/app/features/auth/pages/SignIn/SignIn";

function Page() {
  return (
    <Suspense fallback={<div></div>}>
      <SignIn
        redirectPath="/developers/home"
        signupHref="/developers/signup"
        allowNext={false}
        isDeveloper
      />
    </Suspense>
  );
}

export default Page;
