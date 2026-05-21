import { SetMetadata } from '@nestjs/common';

export const CHECK_OWNERSHIP_KEY = 'checkOwnership';

// Marque une route comme nécessitant une vérification d'appartenance.
// paramName : nom du paramètre URL contenant l'id du cours (ex: 'id', 'courseId')
export const CheckOwnership = (paramName: string = 'id') =>
  SetMetadata(CHECK_OWNERSHIP_KEY, paramName);
