export interface Department {
    departmentId: string;
    departmentName: string;
    doctorCount: number;
}
export interface Service {
    [key: string]: string | number;
}
export interface Address {
    [key: string]: string | number;
}
export interface ProfileData {
    name: string;
    businessName: string;
    address: Address;
    website: string;
    selectedServices: Service[];
    logo?: string;
    image?:String;
}
export interface Organization {
    cognitoId: string;
    departments?: Department[];
    profileData: Partial<ProfileData>;
    businessType: string;
    businessName: string;
    rating?: number;
}
