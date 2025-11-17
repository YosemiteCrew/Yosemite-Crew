import React from "react";

import SignUp from "@/app/pages/SignUp/SignUp";

function Page() {
  return (
    <SignUp
      postAuthRedirect="/developers/home"
      signinHref="/developers/signin"
      allowNext={false}
      isDeveloper
    />
  );
}

export default Page;
