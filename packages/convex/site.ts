import { query } from "./_generated/server";
import { isStaff } from "./lib/roles";
import { siteFlags } from "./lib/site";

/** The mayday switches the web app needs to show notices (open to everyone; nothing private). */
export const status = query({
  args: {},
  handler: async (ctx) => {
    const f = await siteFlags(ctx);
    return {
      maintenance: f.maintenance,
      maintenanceMessage: f.maintenanceMessage,
      banner: f.banner ? { text: f.banner, tone: f.bannerTone } : null,
      communityOff: f.communityOff,
      postingPaused: f.postingPaused,
      signupsPaused: f.signupsPaused,
      uploadsPaused: f.uploadsPaused,
      feedbackPaused: f.feedbackPaused,
      /** Admins get through maintenance and still see Community, to fix and moderate. */
      staff: await isStaff(ctx),
    };
  },
});
