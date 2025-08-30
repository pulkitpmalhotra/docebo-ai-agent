export interface Course {
  id: number;
  name: string;
  description: string;
  code: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  categoryId: number;
  categoryName: string;
  type: string;
  languageId: number;
  languageName: string;
  price: number;
  priceType: string;
  duration: number;
  durationUnit: string;
  imageUrl: string;
  thumbnailUrl: string;
  publicationDate: Date;
  lastEnrollmentDate: Date;
  instructors: string[];
  tags: string[];
  // Add more fields as needed
}
