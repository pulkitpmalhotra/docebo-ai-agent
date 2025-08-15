// app/api/chat/handlers/index.ts - Export barrel for all handlers
import { EnrollmentHandlers } from './enrollment';
import { SearchHandlers } from './search';
import { InfoHandlers } from './info';

export const handlers = {
  enrollment: EnrollmentHandlers,
  search: SearchHandlers,
  info: InfoHandlers
};

export { EnrollmentHandlers, SearchHandlers, InfoHandlers };
