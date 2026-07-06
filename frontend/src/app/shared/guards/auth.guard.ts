import { CanActivateFn } from '@angular/router';

/**
 * Gates every route behind an established identity. "Logged in" here means a
 * userId (the account's bearer token) is present in localStorage. When absent,
 * activation is denied so no page component loads or fetches — AppComponent
 * surfaces the registration/login modal over the blurred shell.
 */
export const authGuard: CanActivateFn = () => !!localStorage.getItem('userId');
