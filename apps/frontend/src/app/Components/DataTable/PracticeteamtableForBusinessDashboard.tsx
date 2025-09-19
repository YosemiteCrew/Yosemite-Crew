"use client";
import React, { useState, useEffect } from "react";
import GenericTable from "../GenericTable/GenericTable";
import Image from "next/image";
import { BsEye } from "react-icons/bs";
import "./DataTable.css";
import { getData } from "@/app/axios-services/services";
import { useOldAuthStore } from "@/app/stores/oldAuthStore";
import { PractitionerDatafromFHIR } from "@yosemite-crew/fhir";

interface PracticeteamtableForBusinessDashboardProps {
  departmentId: string;
  role: string;
}

type Practitioner = {
  cognitoId: string;
  name: string;
  departmentName: string;
  image: string;
  status: string;
  weekWorkingHours: number;
};

const columns = [
  {
    label: "",
    key: "image",
    width: "60px",
    render: (item: Practitioner) => (
      <Image
        src={item.image || "https://d2il6osz49gpup.cloudfront.net/Images/default-avatar.png"}
        alt={item.name}
        width={40}
        height={40}
        style={{ borderRadius: "50%" }}
      />
    ),
  },
  {
    label: "Name",
    key: "name",
    render: (item: Practitioner) => (
      <div className="user-info">
                <div>
                  <p className="name">{item.name}</p>
                  <span className="owner"> {item.departmentName}</span>
                </div>
              </div>
    ),
  },
  {
    label: "Week Working Hours",
    key: "weekWorkingHours",
    render: (item: Practitioner) => (
      <div>
        <div style={{ fontWeight: 500 }}>{item.weekWorkingHours} hrs</div>
      </div>
    ),
  },
  {
    label: "Status",
    key: "status",
    render: (item: Practitioner) => (
    <span className="status-col">{item.status}</span>
),
  },
  
];

function PracticeteamtableForBusinessDashboard({ departmentId, role }: PracticeteamtableForBusinessDashboardProps) {
  const [data, setData] = useState<Practitioner[]>([]);
//   const [loading, setLoading] = useState<boolean>(true);
//   const [error, setError] = useState<string | null>(null);
  const userId = useOldAuthStore((state: any) => state.userId);
console.log("data", data);
  useEffect(() => {
    const fetchPractitioners = async () => {
    //   if (!userId || !departmentId) {
    //     setError("User ID or Department ID is missing");
    //     // setLoading(false);
    //     return;
    //   }

    // //   setLoading(true);
    //   setError(null);
      try {
        const queryParams = new URLSearchParams({
          userId,
          departmentId,
        });
        if (role !== "all") {
          queryParams.append("role", role);
        }

        const response = await getData(`/fhir/v1/getpractionarList?${queryParams.toString()}`);
        if (response.status === 200) {
          const practitionersData:any = response.data;
          setData(PractitionerDatafromFHIR(practitionersData.data|| []));
        } else {
          throw new Error("Failed to fetch practitioners");
        }
      } catch (err) {
        console.error("Error fetching practitioners:", err);
        // setError("Failed to load practitioners");
        setData([]);
      } finally {
        // setLoading(false);
      }
    };

    fetchPractitioners();
  }, [departmentId, role, userId]);

//   if (loading) {
//     return <div className="text-center py-4">Loading...</div>;
//   }

//   if (error) {
//     return <div className="text-center py-4 text-danger">{error}</div>;
//   }

  return (
    <div className="table-wrapper">
      <GenericTable data={data} columns={columns} bordered={false} />
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          padding: "16px 24px 8px 0",
        }}
      >
        <button
          style={{
            border: "1px solid #222",
            borderRadius: 20,
            background: "#fff",
            color: "#222",
            padding: "6px 28px",
            fontWeight: 500,
            fontSize: 16,
            boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
            cursor: "pointer",
          }}
        >
          View All
        </button>
      </div>
    </div>
  );
}

export default PracticeteamtableForBusinessDashboard;