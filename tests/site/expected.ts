/** Addresses of the old site that do not answer 200 on the new one, and what they answer instead. */
const CHINATOWN = "/classes/vancouver-chinatown";
const MT_PLEASANT = "/classes/vancouver-mount-pleasant";
export const expectedRedirects: Record<string, string> = {
  "/home": "/",
  "/paywall": "/",
  "/service-page/beginner-and-intermediate-hand-building-1": CHINATOWN, // 739 Gore Ave
  "/service-page/beginner-to-intermediate-wheel-throwing": MT_PLEASANT, // 322 E 5th Ave
  "/service-page/copy-of-tuesday-evening-wheel-throwing": CHINATOWN,
  "/service-page/test-class": CHINATOWN,
  "/service-page/tuesday-6-30-wheel-throwing": CHINATOWN,
  "/booking-calendar/copy-of-tuesday-evening-wheel-throwing": CHINATOWN,
  "/booking-calendar/tuesday-6-30-wheel-throwing": CHINATOWN,
};
export const expected404 = new Set(["/product-page/private-lessons"]);
