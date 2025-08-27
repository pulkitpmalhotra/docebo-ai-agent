// app/api/chat/handlers/index.ts - Export barrel for all handlers including CSV
import { EnrollmentHandlers } from './enrollment';
import { SearchHandlers } from './search';
import { InfoHandlers } from './info';
import { BulkEnrollmentHandlers } from './bulk-enrollment';
import { CSVEnrollmentHandlers } from './csv-enrollment';
import { ILTSessionHandlers } from './ilt-session';

export const handlers = {
  enrollment: EnrollmentHandlers,
  search: SearchHandlers,
  info: InfoHandlers,
  bulkEnrollment: BulkEnrollmentHandlers,
  csvEnrollment: CSVEnrollmentHandlers,
  iltSession: ILTSessionHandlers
};

export { 
  EnrollmentHandlers, 
  SearchHandlers, 
  InfoHandlers, 
  BulkEnrollmentHandlers,
  CSVEnrollmentHandlers,
  ILTSessionHandlers
};
