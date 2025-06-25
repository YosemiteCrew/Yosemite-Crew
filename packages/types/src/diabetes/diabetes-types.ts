export interface FHIRCodingDiabetes{
    system?: string;
    code?: string;
    display?: string;
}

export interface FHIRCodeDiabetes {
    text?: string;
    coding?: FHIRCodingDiabetes[];
}

export interface FHIRValueQuantityDiabetes {
    value: number;
    unit?: string;
    system?: string;
    code?: string;
}

export interface FHIRComponentDiabetes {
    code: FHIRCodeDiabetes;
    valueQuantity?: FHIRValueQuantityDiabetes;
    valueString?: string;
    valueAttachment?: FHIRAttachmentDiabetes;
}

export interface FHIRAttachmentDiabetes {
    contentType: string;
    url: string;
    title?: string;
}

export interface FHIRObservationDiabetes {
    resourceType: "Observation";
    id: string;
    status: string;
    category: Array<{
        coding: FHIRCodingDiabetes[];
    }>;
    code: FHIRCodeDiabetes;
    subject: {
        reference: string;
    };
    effectiveDateTime: string;
    component: FHIRComponentDiabetes[];
}

export interface DiabetesRecord {
    _id: string;
    userId: string;
    petId: string;
    recordDate: string;
    recordTime: string;
    waterIntake?: string;
    foodIntake?: string;
    activityLevel?: string;
    urination?: string;
    signOfIllness?: string;
    bloodGlucose?: number;
    urineGlucose?: number;
    urineKetones?: number;
    weight?: number;
    bodyCondition?: Array<{
        mimetype: string;
        url: string;
        originalname: string;
    }>;
}

export interface ParsedDiabetesObservation {
    petId: string | null;
    recordDate: string | null;
    recordTime: string | null;
    waterIntake: string | null;
    foodIntake: string | null;
    activityLevel: string | null;
    urination: string | null;
    signOfIllness: string | null;
    bloodGlucose: number | null;
    urineGlucose: number | null;
    urineKetones: number | null;
    weight: number | null;
}