/**
 * Returns true when the app is running in demo/showcase mode.
 * In demo mode:
 *  - Default credentials are always shown on the login page
 *  - The "change your password" dashboard banner is suppressed
 *  - Password changes are blocked (API returns 403)
 */
export function isDemoMode() {
    return process.env.HELPNEST_DEMO_MODE === 'true';
}
