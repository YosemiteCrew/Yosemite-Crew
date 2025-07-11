"use client";
import React, { useState } from "react";
import "./DataTable.css"
import { Table, Button, Form } from "react-bootstrap";

interface Assessment {
  id: number;
  name: string;
  category: string;
  description: string;
  suitableFor: string;
  enabled: boolean;
}

const initialAssessments: Assessment[] = [
  {
    id: 1,
    name: "Feline Grimace Scale",
    category: "Behavior & Pain",
    description: "A facial expression-based tool to evaluate pain in cats.",
    suitableFor: "Cats",
    enabled: true,
  },
  {
    id: 2,
    name: "Equine Grimace Scale",
    category: "Behavior & Pain",
    description: "An assessment to gauge pain in horses through facial cues.",
    suitableFor: "Horses",
    enabled: true,
  },
  {
    id: 3,
    name: "Canine Grimace Scale",
    category: "Behavior & Pain",
    description: "Pain evaluation scale based on canine facial expressions.",
    suitableFor: "Dogs",
    enabled: true,
  },
  {
    id: 4,
    name: "Parasiticide Risk",
    category: "Preventive Care",
    description: "Evaluates a pet's risk of tick, flea, and parasitic infestations.",
    suitableFor: "Cats, Dogs, Horses",
    enabled: false,
  },
  {
    id: 5,
    name: "Diabetes Assessment",
    category: "Chronic Condition",
    description: "A screening tool to identify early signs of diabetes in pets.",
    suitableFor: "Cats, Dogs, Horses",
    enabled: true,
  },
  {
    id: 6,
    name: "Pain Assessment",
    category: "General Health",
    description: "Helps assess pain levels in pets for better treatment and management.",
    suitableFor: "Cats, Dogs, Horses",
    enabled: false,
  },
];

export default function AssessmentCatalogue() {
  const [assessments, setAssessments] = useState<Assessment[]>(initialAssessments);

  const handleToggle = (id: number) => {
    const updated = assessments.map((a) =>
      a.id === id ? { ...a, enabled: !a.enabled } : a
    );
    setAssessments(updated);
  };

  const handleUpdateCatalogue = () => {
    console.log("Updated Assessments:", assessments);
    // You can send this to your API here
    alert("Catalogue updated!");
  };

  return (
    <div className="p-4">
      <h3>Assessment Catalogue</h3>
      <Table bordered hover responsive className="TableDiv">
        <thead>
          <tr>
            <th></th>
            <th>Assessment Name</th>
            <th>Category</th>
            <th>Description</th>
            <th>Suitable For</th>
          </tr>
        </thead>
        <tbody>
          {assessments.map((a) => (
            <tr key={a.id}>
              <td>
                <Form.Check
                  type="switch"
                  checked={a.enabled}
                  onChange={() => handleToggle(a.id)}
                />
              </td>
              <td><p>{a.name}</p></td>
              <td><p>{a.category}</p></td>
              <td><p>{a.description}</p></td>
              <td><p>{a.suitableFor}</p></td>
            </tr>
          ))}
        </tbody>
      </Table>

      <div className="d-flex gap-3 mt-3">
        <Button variant="outline-dark">🗒️ Suggest an Assessment</Button>
        <Button variant="dark" onClick={handleUpdateCatalogue}>
          ✅ Update Catalogue
        </Button>
      </div>
    </div>
  );
}
