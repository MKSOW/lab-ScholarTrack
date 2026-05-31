import { SetMetadata } from '@nestjs/common';

export const CHECK_OWNERSHIP_KEY = 'checkOwnership';

// Marks a route as requiring an ownership check.
// paramName: name of the URL param holding the course id (e.g. 'id', 'courseId')
export const CheckOwnership = (paramName: string = 'id') =>
  SetMetadata(CHECK_OWNERSHIP_KEY, paramName);
