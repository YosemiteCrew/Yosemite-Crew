"use client";
import React, { useState } from "react";
import Link from "next/link";
import { IoIosCheckmark, IoIosCloseCircleOutline } from "react-icons/io";

import FormInput from "@/app/components/Inputs/FormInput/FormInput";
import Faq from "@/app/components/Faq/Faq";
import Footer from "@/app/components/Footer/Footer";
import { PricingPlans, TableData } from "./data";
import { Primary } from "@/app/components/Buttons";

import "./PricingPage.css";

const renderCell = (text: string) => {
  if (text === "yes") {
    return <IoIosCheckmark size={20} color="#595958" />;
  } else if (text === "no") {
    return "-";
  } else {
    return text;
  }
};

const PricingPage = () => {
  const [activeCycle, setActiveCycle] = useState("yearly");
  const [notify, setNotify] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
  });
  const [formDataErrors, setFormDataErrors] = useState<{
    firstName?: string;
    lastName?: string;
    email?: string;
  }>({});

  const handleSend = () => {
    const errors: {
      firstName?: string;
      lastName?: string;
      email?: string;
    } = {};
    if (!formData.firstName) errors.firstName = "First name is required";
    if (!formData.lastName) errors.lastName = "Last name is required";
    if (!formData.email) errors.email = "Email is required";
    setFormDataErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    setNotify(false);
    setFormData({
      firstName: "",
      lastName: "",
      email: "",
    });
    setFormDataErrors({});
  };

  return (
    <>
      <section className="pricingSection">
        <div className="PricingData">
          <div className="PricingPage-header">
            <div className="PriceBackdiv">
              <div className="PricinhHeadquote">
                <div className="text-display-1 text-text-primary">Transparent pricing, no hidden fees</div>
                <div className="text-body-3 text-text-primary">
                  Choose a plan that fits your pet-care practice. Upgrade
                  anytime as you grow.
                </div>
              </div>
            </div>
            <div className="flex gap-4 flex-col w-full max-w-5xl">
              <div className="w-full flex items-center justify-between gap-3 flex-col sm:flex-row">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setActiveCycle("monthly")}
                    className={`${activeCycle === "monthly" ? "border-blue-text! bg-blue-light text-blue-text shadow-[0_0_8px_0_rgba(0,0,0,0.16)]" : "border-black-text!"} hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] px-3 h-9 flex items-center justify-center border! rounded-2xl! cursor-pointer font-satoshi! text-[15px]! font-medium text-black-text`}
                  >
                    Pay monthly
                  </button>
                  <button
                    onClick={() => setActiveCycle("yearly")}
                    className={`${activeCycle === "yearly" ? "border-blue-text! bg-blue-light text-blue-text shadow-[0_0_8px_0_rgba(0,0,0,0.16)]" : "border-black-text!"} hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] px-3 h-9 flex items-center justify-center border! rounded-2xl! cursor-pointer font-satoshi! text-[15px]! font-medium text-black-text`}
                  >
                    Pay yearly
                  </button>
                </div>
                <div className="flex-1 flex justify-between gap-3 sm:gap-0">
                  <div className="text-[15px] font-satoshi text-blue-text font-bold">
                    Save up to 20% with yearly
                  </div>
                  <div className="text-[15px] font-satoshi text-grey-noti font-bold">
                    Price in USD
                  </div>
                </div>
              </div>
              <div className="flex gap-3 lg:gap-[30px] justify-between w-full flex-col md:flex-row">
                {PricingPlans.map((plan: any) => (
                  <div
                    key={plan.id}
                    className="p-3 flex flex-col gap-2 lg:gap-3 w-full md:w-[calc(33%-11px)] lg:w-[calc(33%-20px)] rounded-[20px]! border border-grey-light!"
                  >
                    <div className="flex items-center gap-2 font-medium h-[23px] lg:h-[38px]">
                      <div
                        className={`font-grotesk text-[14px] lg:text-[19px] ${plan.active ? "text-black-text" : "text-grey-border"}`}
                      >
                        {plan.title}
                      </div>
                      {plan.recommended && (
                        <div className="p-1 lg:p-2 rounded-lg bg-blue-light text-blue-text font-satoshi text-[12px] lg:text-[15px] font-normal">
                          Recommended
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 items-end">
                      <div
                        className={`font-grotesk text-[28px] lg:text-[40px] font-medium ${plan.active ? "text-black-text" : "text-grey-border"}`}
                      >
                        {activeCycle === "monthly"
                          ? plan.amount
                          : plan.amountYearly}
                      </div>
                      {plan.amountLabel && (
                        <div className="mb-1.5! lg:mb-3! font-satoshi text-[13px] font-semibold text-black-text">
                          {plan.amountLabel}
                        </div>
                      )}
                    </div>
                    <div
                      className={`font-satoshi text-[13px] lg:text-[15px] font-normal ${plan.active ? "text-black-text" : "text-grey-border"}`}
                    >
                      {plan.description}
                    </div>
                    <Link
                      className="w-full rounded-2xl! hover:border-text-brand! hover:text-text-brand! hover:scale-105! transition duration-200 ease-in-out text-black-text! border-black-text! border! h-12 flex items-center justify-center font-grotesk text-[19px] font-medium"
                      href={plan.buttonSrc}
                      onClick={() => plan.id === 3 && setNotify(true)}
                    >
                      {plan.buttonText}
                    </Link>
                    <div>
                      <div
                        className={`font-satoshi text-[13px] lg:text-[15px] font-semibold ${plan.active ? "text-black-text" : "text-grey-border"}`}
                      >
                        Includes:
                      </div>
                      {plan.includes.map((detail: string) => (
                        <div
                          key={detail}
                          className={`flex font-satoshi text-[13px] lg:text-[15px] gap-2 font-normal ${plan.active ? "text-black-text" : "text-grey-border"}`}
                        >
                          &bull; <span>{detail}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {notify && (
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] sm:w-[500px] z-10 bg-white py-6! sm:py-8! px-4! sm:px-5! flex flex-col gap-3 sm:gap-6 rounded-3xl shadow-[0_0_32px_0_rgba(0,0,0,0.32)]">
              <div className="flex w-full items-center justify-between">
                <button className="opacity-0">
                  <IoIosCloseCircleOutline size={28} color="#302f2e" />
                </button>
                <div className="font-grotesk font-medium text-[23px] text-black-text">
                  Get notified
                </div>
                <button onClick={() => setNotify(false)}>
                  <IoIosCloseCircleOutline size={28} color="#302f2e" />
                </button>
              </div>
              <div className="font-satoshi text-black-text font-semibold text-[18px]">
                Email notifications are available for Enterprise Plan users.
                Please provide your details to receive updates.
              </div>
              <div className="grid grid-cols-2 gap-3 sm:gap-6">
                <FormInput
                  intype="text"
                  inname="First name"
                  value={formData.firstName}
                  inlabel="First name"
                  onChange={(e) =>
                    setFormData({ ...formData, firstName: e.target.value })
                  }
                  error={formDataErrors.firstName}
                />
                <FormInput
                  intype="text"
                  inname="Last name"
                  value={formData.lastName}
                  inlabel="Last name"
                  onChange={(e) =>
                    setFormData({ ...formData, lastName: e.target.value })
                  }
                  error={formDataErrors.lastName}
                />
              </div>
              <FormInput
                intype="email"
                inname="Email"
                value={formData.email}
                inlabel="Enter email"
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                error={formDataErrors.email}
              />
              <Primary href="#" onClick={handleSend} text="Send" />
            </div>
          )}

          <div className="flex flex-col gap-3 md:gap-9">
            <div className="text-display-1 text-text-primary text-center">
              Plans and features
            </div>
            <div className="flex gap-3">
              <div className="w-[calc(33%-10px)]"></div>
              {PricingPlans.slice(0, 2).map((plan: any) => (
                <div
                  key={plan.description}
                  className="w-[calc(33%-10px)] flex flex-col gap-2"
                >
                  <div className="flex justify-between items-center flex-wrap">
                    <div className="font-grotesk text-[14px] md:text-[19px] font-medium text-black-text">
                      {plan.title.split(" ")[0]}
                    </div>
                    <div className="font-grotesk text-[14px] md:text-[19px] font-medium text-black-text">
                      {activeCycle === "monthly"
                        ? plan.amount
                        : plan.amountYearly}
                    </div>
                  </div>
                  <Link
                    className="w-full rounded-2xl! hover:border-text-brand! hover:text-text-brand! hover:scale-105! text-black-text! border-black-text! border! transition duration-300 ease-in-out h-8 md:h-12 flex items-center justify-center font-grotesk text-[14px] md:text-[19px] font-medium"
                    href={plan.buttonSrc}
                  >
                    {plan.buttonText}
                  </Link>
                </div>
              ))}
            </div>
            <div className="w-full flex flex-col gap-10">
              {TableData.map((table) => (
                <div
                  key={table.head}
                  className="border! border-grey-light! rounded-2xl! pt-5!"
                >
                  <table className="w-full">
                    <thead className="w-full">
                      <tr>
                        <th
                          className="w-full pb-3 pl-4! md:pl-6! font-satoshi font-semibold text-[18px] text-black-text"
                          colSpan={3}
                        >
                          {table.head}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="w-full">
                      {table.rows.map((row) => (
                        <tr key={row.name}>
                          <td className="w-1/3 py-3 pl-4! md:pl-6! border-t! border-grey-light! font-satoshi font-semibold text-[15px] text-grey-noti">
                            {row.name}
                          </td>
                          <td className="w-1/3 py-3 pl-4! md:pl-6! border-t! border-grey-light! font-satoshi font-semibold text-[15px] text-grey-noti">
                            {renderCell(row.free)}
                          </td>
                          <td className="w-1/3 py-3 pl-4! md:pl-6! border-t! border-grey-light! font-satoshi font-semibold text-[15px] text-grey-noti">
                            {renderCell(row.business)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>

          <Faq />
          <NeedHealp />
        </div>
      </section>
      <Footer />
    </>
  );
};

export default PricingPage;

const NeedHealp = () => {
  return (
    <div className="NeedHelpDiv">
      <div className="Needhelpitem">
        <div className="helpText">
          <h3>Need Help? We&rsquo;re All Ears!</h3>
          <p>
            Got questions or need assistance? Just reach out! Our team is here
            to help.
          </p>
        </div>
        <div className="helpbtn">
          <Link href="/contact">Contact support</Link>
        </div>
      </div>
    </div>
  );
};

export { NeedHealp };
