import React, { useState } from "react";
import CenterModal from "../Modal/CenterModal";
import { Primary } from "../Buttons";
import { BillingSubscriptionInterval } from "@/app/types/billing";
import { getUpgradeLink } from "@/app/services/billingService";
import Close from "../Icons/Close";

const Upgrade = () => {
  const [selectPopup, setSelectPopup] = useState(false);
  const [selectedLabel, setSelectedLabel] =
    useState<BillingSubscriptionInterval>("month");
  const [loadingUpgrade, setLoadingUpgrade] =
    useState<null | BillingSubscriptionInterval>(null);

  const handleUpgrade = async () => {
    setLoadingUpgrade(selectedLabel);
    try {
      const url = await getUpgradeLink(selectedLabel);
      setSelectPopup(false);
      setTimeout(() => {
        globalThis.location.href = url;
      }, 500);
    } catch (e: any) {
      console.log(e);
    } finally {
      setLoadingUpgrade(null);
    }
  };

  const handleCancel = () => {
    setSelectPopup(false);
  };

  return (
    <>
      <div className="flex justify-center">
        <Primary href="#" onClick={() => setSelectPopup(true)} text="Upgrade" />
      </div>
      <CenterModal
        showModal={selectPopup}
        setShowModal={setSelectPopup}
        onClose={handleCancel}
      >
        <div className="flex justify-between items-center">
          <div className="opacity-0">
            <Close onClick={() => {}} />
          </div>
          <div className="flex justify-center items-center gap-2">
            <div className="text-body-1 text-text-primary">Select billing cycle</div>
          </div>
          <Close onClick={handleCancel} />
        </div>
        <div className="w-full flex items-center justify-between gap-2 flex-col">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedLabel("month")}
              className={`${selectedLabel === "month" ? "border-blue-text! bg-blue-light text-blue-text" : "border-black-text! hover:bg-card-hover"} px-3 h-9 flex items-center justify-center border! rounded-2xl! cursor-pointer`}
            >
              <span className="text-caption-1 text-text-primary">
                Pay monthly
              </span>
            </button>
            <button
              onClick={() => setSelectedLabel("year")}
              className={`${selectedLabel === "year" ? "border-blue-text! bg-blue-light text-blue-text" : "border-black-text! hover:bg-card-hover"} px-3 h-9 flex items-center justify-center border! rounded-2xl! cursor-pointer`}
            >
              <span className="text-caption-1 text-text-primary">
                Pay yearly
              </span>
            </button>
          </div>
          <div className="flex-1 flex justify-between gap-2">
            <div className="text-caption-1 text-text-brand">
              Save up to 20% with yearly
            </div>
            <div className="text-caption-1 text-text-secondary">
              Price in EUR
            </div>
          </div>
        </div>
        <div className="p-3 flex flex-col items-center justify-center gap-3 w-full rounded-2xl! border border-grey-light!">
          <div className={`text-body-4 text-text-primary`}>Business plan</div>
          <div className="flex gap-2 items-end">
            <div className={`text-display-1 text-text-primary`}>
              {selectedLabel === "month" ? "€12" : "€10"}
            </div>
            <div className="text-caption-1 text-text-primary mb-1.5">
              per member / month
            </div>
          </div>
        </div>
        <Primary
          href="#"
          onClick={handleUpgrade}
          text={loadingUpgrade ? "Redirecting..." : "Upgrade"}
          isDisabled={loadingUpgrade !== null}
        />
      </CenterModal>
    </>
  );
};

export default Upgrade;
