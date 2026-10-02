/** What the home page's hero stage tells the header and the mobile call bar. */
export type StageState = { overStage: boolean; cardVisible: boolean };

/** Header and the mobile call bar listen for this to change tone / hide. */
export const STAGE_EVENT = "hec:stage";
