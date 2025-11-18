"use client";
import React, { useState } from "react";
import Link from "next/link";
import { IoIosCheckmark } from "react-icons/io";

import Faq from "@/app/components/Faq/Faq";
import Footer from "@/app/components/Footer/Footer";
import { PricingPlans, TableData } from "./data";

import "./PricingPage.css";

const renderCell = (text: string) => {
  if (text === "yes") {
    return <IoIosCheckmark size={20} color="#595958" />
  } else if (text === "no") {
    return "-"
  } else{
    return text;
  }
}

const PricingPage = () => {
  const [activeCycle, setActiveCycle] = useState("monthly");

  return (
    <>
      <section className="pricingSection">
        <div className="PricingData">
          <div className="PricingPage-header">
            <div className="PriceBackdiv">
              <div className="PricinhHeadquote">
                <h2>Transparent pricing, no hidden fees</h2>
                <p>
                  Choose a plan that fits your pet-care practice. Upgrade
                  anytime as you grow.
                </p>
              </div>
            </div>
            <div className="flex gap-4 flex-col w-full max-w-5xl">
              <div className="w-full flex items-center justify-between gap-3 flex-col sm:flex-row">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setActiveCycle("monthly")}
                    className={`${activeCycle === "monthly" ? "border-blue-text! bg-blue-light text-blue-text" : "border-black-text!"} px-3 h-9 flex items-center justify-center border! rounded-2xl! cursor-pointer font-satoshi! text-[15px]! font-medium text-black-text`}
                  >
                    Pay monthly
                  </button>
                  <button
                    onClick={() => setActiveCycle("yearly")}
                    className={`${activeCycle === "yearly" ? "border-blue-text! bg-blue-light text-blue-text" : "border-black-text!"} px-3 h-9 flex items-center justify-center border! rounded-2xl! cursor-pointer font-satoshi! text-[15px]! font-medium text-black-text`}
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
                        <div className="p-1 lg:p-2 rounded-lg bg-blue-light text-blue-text font-satoshi text-[12px] lg:text-[15px] font-semibold">
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
                      className="w-full rounded-2xl! border-[1.5px]! border-black-text! h-12 flex items-center justify-center font-grotesk text-[19px] text-black-text! font-medium"
                      href={plan.buttonSrc}
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

          <div className="flex flex-col gap-3 md:gap-9">
            <div className="font-grotesk text-[23px] md:text-[33px] xl:text-[48px] text-black-text text-center font-medium">
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
                    className="w-full rounded-2xl! border-[1.5px]! border-black-text! h-8 md:h-12 flex items-center justify-center font-grotesk text-[14px] md:text-[19px] text-black-text! font-medium"
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
          <h3>Need Help? We’re All Ears!</h3>
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
