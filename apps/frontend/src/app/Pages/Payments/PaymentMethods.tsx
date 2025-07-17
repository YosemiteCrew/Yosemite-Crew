'use client';
import React, { useState } from "react";
import { Container } from 'react-bootstrap';
import "./Payments.css";
import DynamicSelect from '@/app/Components/DynamicSelect/DynamicSelect';
import Switch from "@/app/Components/Switch/Switch";
import Image from "next/image";
import { HeadText } from "../CompleteProfile/CompleteProfile";

type PaymentMethod = {
    name: string;
    icon?: string;
    enabled: boolean;
};

const initialPaymentMethods: PaymentMethod[] = [
    { name: 'Cash', enabled: true },
    { name: 'Credit and Debit Cards', enabled: true },
    { name: 'Bank Transfer', enabled: true },
    { name: 'Cheque', enabled: false },
    { name: 'Apple Pay', icon: '/Images/pay1.png', enabled: true },
    { name: 'Google Pay', icon: '/Images/pay2.png', enabled: false },
    { name: 'Amazon Pay', icon: '/Images/pay3.png', enabled: false },
    { name: 'Klarna', icon: '/Images/pay4.png', enabled: true },
    { name: 'PayPal', icon: '/Images/pay5.png', enabled: true },
    { name: 'Paysafe', icon: '/Images/pay6.png', enabled: true },
    { name: 'Stripe', icon: '/Images/pay7.png', enabled: true },
];

function PaymentMethods() {
    const [country, setCountry] = useState<string>("");
    const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(initialPaymentMethods);

    const handlePaymentMethodToggle = (index: number, enabled: boolean) => {
        const newPaymentMethods = [...paymentMethods];
        newPaymentMethods[index].enabled = enabled;
        setPaymentMethods(newPaymentMethods);
    };

    type Option = {
        value: string;
        label: string;
    };
    const options: Option[] = [
        { value: 'us', label: '🇺🇸 United States' },
        { value: 'in', label: '🇮🇳 India' },
        { value: 'uk', label: '🇬🇧 United Kingdom' },
    ];

    return (
        <>
            <section className='PaymentsMethodsSec'>
                <Container>
                    <div className="PaymetsData">

                        <div className="mb-3">
                            <HeadText blktext="Manage Payment" Spntext="Methods" />
                        </div>

                        <div className="PaymentsDivde">
                            <div className="LeftPay">
                                <div className="PaymentList">
                                    {paymentMethods.map((method, index) => (
                                        <div key={index} className="PaymentItem">
                                            <div className="PaymentInfo">
                                                {method.icon && <Image src={method.icon} alt={`${method.name} icon`} width={58} height={40} />}
                                                <h6>{method.name}</h6>
                                            </div>
                                            <Switch
                                                checked={method.enabled}
                                                onChange={(enabled) => handlePaymentMethodToggle(index, enabled)}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="RightPay">
                                <DynamicSelect options={options} value={country} onChange={setCountry} inname="country" placeholder="Default Currency" />
                                <DynamicSelect options={options} value={country} onChange={setCountry} inname="country" placeholder="Default Payment Method" /> 
                            </div>
                        </div>
                    </div>
                </Container>
            </section>
        </>
    );
}

export default PaymentMethods
