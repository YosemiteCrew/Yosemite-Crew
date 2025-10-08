"use client";
import React from "react";
import { Card } from "react-bootstrap";

import "./BarGraph.css";

interface BlankDonutCardProps {
  title: string;
  labels: { text: string; value: number }[];
}

const BlankDonutCard: React.FC<BlankDonutCardProps> = ({ title, labels }) => {
  return (
    <div className="DonutCardDiv">
      <h6>{title}</h6>
      <Card className="DonutCard">
        <div className="WeekTexed">
          <p>
            Pet Per Week <span>00</span>
          </p>
        </div>

        <div className="WeekDonutDiv">
          <div className="donut-placeholder" />
          <div className="WeekReports">
            {labels.map((label) => (
              <div key={label.text} className="WeekReportsItem">
                <p>
                  <span className="dot"></span>
                  {label.text}
                </p>
                <p>00</p>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default BlankDonutCard;
