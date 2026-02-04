import { postData } from "@/app/services/axios";

type RedirectResponse = {
  redirectUrl: string;
};

export const fetchDocumensoRedirectUrl = async (
  orgId: string,
): Promise<RedirectResponse> => {
  const res = await postData<RedirectResponse>(
    `/v1/documenso/pms/redirect/${orgId}`,
  );
  return res.data;
};
