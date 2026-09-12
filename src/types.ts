/**
 * Data structures and types for realestate-intel-mcp
 */

export interface RealtorTaxRecord {
  year: number;
  tax: number;
  assessment?: number;
}

export interface RealtorPriceEvent {
  date: string;
  event: string;
  price: number;
  priceChangePercent?: number;
}

export interface RealtorSchool {
  name: string;
  rating?: number;
  grades?: string;
  distanceMiles?: number;
  type?: string;
}

export interface RealtorPropertyIntel {
  url: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
    county?: string;
  };
  price: number;
  pricePerSqft?: number;
  beds?: number;
  baths?: number;
  sqft?: number;
  lotSqft?: number;
  yearBuilt?: number;
  propertyType?: string;
  daysOnMarket?: number;
  hoaFeeMonthly?: number;
  taxAssessment?: {
    totalValue?: number;
    landValue?: number;
    improvementValue?: number;
    assessmentYear?: number;
    parcelId?: string;
  };
  taxHistory: RealtorTaxRecord[];
  priceHistory: RealtorPriceEvent[];
  schools: RealtorSchool[];
  listingAgent?: {
    name?: string;
    brokerage?: string;
    mlsId?: string;
  };
  compliance: {
    isConsumerReport: false;
    disclaimer: string;
  };
}

export interface IdealistaPropertyIntel {
  url: string;
  title: string;
  price: number;
  pricePerSqm?: number;
  sizeSqm?: number;
  rooms?: number;
  bathrooms?: number;
  floor?: string;
  energyRating?: string;
  location: {
    municipality: string;
    district?: string;
    province?: string;
    country: string;
  };
  estimatedGrossYieldPercent?: number;
  touristLicenseDeclared: boolean;
  touristLicenseNumber?: string;
  advertiser?: {
    type: 'agency' | 'private';
    name?: string;
  };
  compliance: {
    gdprNotice: string;
  };
}
